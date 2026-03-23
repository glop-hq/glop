import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dashboardQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type {
  AnalyticsPeriod,
  ContextHealthResponse,
  ContextHealthSummary,
  ContextHealthTrendPoint,
  RepoContextHealthRow,
  RepoContextRecommendation,
} from "@glop/shared";
import {
  isRecommendationStale,
  refreshRepoRecommendation,
} from "@/lib/context-health-scorer";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;

    const parsed = dashboardQuerySchema.safeParse({
      workspace_id: sp.get("workspace_id") ?? undefined,
      period: sp.get("period") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id, period } = parsed.data as {
      workspace_id: string;
      period: AnalyticsPeriod;
    };
    requireWorkspaceMember(session, workspace_id);

    const db = getDb();
    const days = PERIOD_DAYS[period];
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    periodStart.setHours(0, 0, 0, 0);
    const periodStartStr = periodStart.toISOString();

    const baseWhere = and(
      eq(schema.run_context_health.workspace_id, workspace_id),
      sql`${schema.run_context_health.created_at} >= ${periodStartStr}`
    );

    const [summaryRows, trendRows, repoRows] =
      await Promise.all([
        // Workspace-level summary
        db
          .select({
            total: sql<number>`count(*)::int`,
            compacted: sql<number>`count(*) FILTER (WHERE ${schema.run_context_health.compaction_count} > 0)::int`,
            avg_compactions: sql<number>`avg(${schema.run_context_health.compaction_count})`,
            avg_first_compaction_min: sql<number>`avg(${schema.run_context_health.first_compaction_at_min}) FILTER (WHERE ${schema.run_context_health.first_compaction_at_min} IS NOT NULL)`,
            avg_peak_utilization: sql<number>`avg(${schema.run_context_health.peak_utilization_pct}) FILTER (WHERE ${schema.run_context_health.peak_utilization_pct} IS NOT NULL)`,
            above_80: sql<number>`count(*) FILTER (WHERE ${schema.run_context_health.peak_utilization_pct} > 80)::int`,
            with_utilization: sql<number>`count(*) FILTER (WHERE ${schema.run_context_health.peak_utilization_pct} IS NOT NULL)::int`,
          })
          .from(schema.run_context_health)
          .where(baseWhere),

        // Weekly trend
        db
          .select({
            date: sql<string>`date_trunc('week', ${schema.run_context_health.created_at})::date::text`,
            total: sql<number>`count(*)::int`,
            compacted: sql<number>`count(*) FILTER (WHERE ${schema.run_context_health.compaction_count} > 0)::int`,
            avg_compactions: sql<number>`avg(${schema.run_context_health.compaction_count})`,
          })
          .from(schema.run_context_health)
          .where(baseWhere)
          .groupBy(
            sql`date_trunc('week', ${schema.run_context_health.created_at})`
          )
          .orderBy(
            sql`date_trunc('week', ${schema.run_context_health.created_at})`
          ),

        // Per-repo breakdown (top 20 by session count)
        db
          .select({
            repo_id: sql<string>`${schema.run_context_health.repo_id}::text`,
            repo_key: schema.repos.repo_key,
            total: sql<number>`count(*)::int`,
            compacted: sql<number>`count(*) FILTER (WHERE ${schema.run_context_health.compaction_count} > 0)::int`,
            avg_compactions: sql<number>`avg(${schema.run_context_health.compaction_count})`,
            avg_first_compaction_min: sql<number>`avg(${schema.run_context_health.first_compaction_at_min}) FILTER (WHERE ${schema.run_context_health.first_compaction_at_min} IS NOT NULL)`,
          })
          .from(schema.run_context_health)
          .innerJoin(
            schema.repos,
            eq(schema.repos.id, schema.run_context_health.repo_id)
          )
          .where(baseWhere)
          .groupBy(schema.run_context_health.repo_id, schema.repos.repo_key)
          .orderBy(sql`count(*) DESC`)
          .limit(20),
      ]);

    // Lazy-refresh stale recommendations for repos with enough data
    try {
      const repoIdsToRefresh = repoRows
        .filter((r) => Number(r.total) >= 20)
        .map((r) => r.repo_id);
      for (const rid of repoIdsToRefresh) {
        if (await isRecommendationStale(db, rid)) {
          await refreshRepoRecommendation(db, rid, workspace_id);
        }
      }
    } catch {
      // Best-effort — don't fail the request if refresh fails
    }

    // Re-fetch recommendations after potential refresh
    const freshRecommendationRows = await db
      .select({
        repo_id: sql<string>`${schema.repo_context_recommendations.repo_id}::text`,
        recommended_max_duration_min:
          schema.repo_context_recommendations.recommended_max_duration_min,
        confidence: schema.repo_context_recommendations.confidence,
        sample_size: schema.repo_context_recommendations.sample_size,
        reasoning: schema.repo_context_recommendations.reasoning,
      })
      .from(schema.repo_context_recommendations)
      .where(
        eq(schema.repo_context_recommendations.workspace_id, workspace_id)
      );

    const s = summaryRows[0];
    const total = Number(s?.total ?? 0);
    const compacted = Number(s?.compacted ?? 0);

    const withUtil = Number(s?.with_utilization ?? 0);
    const above80 = Number(s?.above_80 ?? 0);

    const summary: ContextHealthSummary = {
      pct_sessions_compacted: total > 0 ? round1((compacted / total) * 100) : 0,
      avg_compactions_per_session: total > 0 ? round1(Number(s?.avg_compactions ?? 0)) : 0,
      avg_duration_before_first_compaction_min:
        s?.avg_first_compaction_min != null
          ? round1(Number(s.avg_first_compaction_min))
          : null,
      avg_peak_utilization_pct:
        s?.avg_peak_utilization != null
          ? round1(Number(s.avg_peak_utilization))
          : null,
      pct_sessions_above_80:
        withUtil > 0 ? round1((above80 / withUtil) * 100) : null,
      total_sessions_with_data: total,
      trend: trendRows.map(
        (r): ContextHealthTrendPoint => ({
          date: r.date,
          pct_compacted:
            Number(r.total) > 0
              ? round1((Number(r.compacted) / Number(r.total)) * 100)
              : 0,
          avg_compactions: round1(Number(r.avg_compactions ?? 0)),
        })
      ),
    };

    const by_repo: RepoContextHealthRow[] = repoRows.map((r) => {
      const rTotal = Number(r.total);
      const rCompacted = Number(r.compacted);
      return {
        repo_id: r.repo_id,
        repo_key: r.repo_key,
        pct_sessions_compacted:
          rTotal > 0 ? round1((rCompacted / rTotal) * 100) : 0,
        avg_compactions_per_session:
          rTotal > 0 ? round1(Number(r.avg_compactions ?? 0)) : 0,
        avg_duration_before_first_compaction_min:
          r.avg_first_compaction_min != null
            ? round1(Number(r.avg_first_compaction_min))
            : null,
        avg_peak_utilization_pct: null, // not computed per-repo in workspace view
        pct_sessions_above_80: null,
        total_sessions_with_data: rTotal,
        trend: [], // per-repo trend omitted in workspace view for performance
      };
    });

    const recommendations: RepoContextRecommendation[] = freshRecommendationRows.map(
      (r) => ({
        repo_id: r.repo_id,
        recommended_max_duration_min: r.recommended_max_duration_min,
        confidence: r.confidence,
        sample_size: r.sample_size,
        reasoning: r.reasoning,
      })
    );

    const response: ContextHealthResponse = {
      period,
      summary,
      by_repo,
      recommendations,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json(
        { error: error.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    console.error("Dashboard context-health error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { analyticsPeriodSchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type {
  AnalyticsPeriod,
  ContextHealthSummary,
  ContextHealthTrendPoint,
  RepoContextRecommendation,
} from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const session = await requireSession();
    const { repoId } = await params;
    const sp = request.nextUrl.searchParams;
    const workspaceId = sp.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const periodParsed = analyticsPeriodSchema.safeParse(
      sp.get("period") ?? "7d"
    );
    const period: AnalyticsPeriod = periodParsed.success
      ? periodParsed.data
      : "7d";

    const db = getDb();
    const days = PERIOD_DAYS[period];
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    periodStart.setHours(0, 0, 0, 0);
    const periodStartStr = periodStart.toISOString();

    const baseWhere = and(
      eq(schema.run_context_health.repo_id, repoId),
      sql`${schema.run_context_health.created_at} >= ${periodStartStr}`
    );

    const [summaryRows, trendRows, recRows] = await Promise.all([
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

      db
        .select({
          date: sql<string>`date_trunc('week', ${schema.run_context_health.created_at})::date::text`,
          total: sql<number>`count(*)::int`,
          compacted: sql<number>`count(*) FILTER (WHERE ${schema.run_context_health.compaction_count} > 0)::int`,
          avg_compactions: sql<number>`avg(${schema.run_context_health.compaction_count})`,
          avg_peak_utilization: sql<number>`avg(${schema.run_context_health.peak_utilization_pct}) FILTER (WHERE ${schema.run_context_health.peak_utilization_pct} IS NOT NULL)`,
        })
        .from(schema.run_context_health)
        .where(baseWhere)
        .groupBy(
          sql`date_trunc('week', ${schema.run_context_health.created_at})`
        )
        .orderBy(
          sql`date_trunc('week', ${schema.run_context_health.created_at})`
        ),

      db
        .select({
          repo_id: sql<string>`${schema.repo_context_recommendations.repo_id}::text`,
          repo_key: schema.repos.repo_key,
          recommended_max_duration_min:
            schema.repo_context_recommendations.recommended_max_duration_min,
          confidence: schema.repo_context_recommendations.confidence,
          sample_size: schema.repo_context_recommendations.sample_size,
          reasoning: schema.repo_context_recommendations.reasoning,
        })
        .from(schema.repo_context_recommendations)
        .innerJoin(
          schema.repos,
          eq(schema.repos.id, schema.repo_context_recommendations.repo_id)
        )
        .where(eq(schema.repo_context_recommendations.repo_id, repoId))
        .limit(1),
    ]);

    const s = summaryRows[0];
    const total = Number(s?.total ?? 0);
    const compacted = Number(s?.compacted ?? 0);

    const withUtil = Number(s?.with_utilization ?? 0);
    const above80 = Number(s?.above_80 ?? 0);

    const summary: ContextHealthSummary = {
      pct_sessions_compacted:
        total > 0 ? round1((compacted / total) * 100) : 0,
      avg_compactions_per_session:
        total > 0 ? round1(Number(s?.avg_compactions ?? 0)) : 0,
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
          avg_peak_utilization_pct:
            r.avg_peak_utilization != null
              ? round1(Number(r.avg_peak_utilization))
              : null,
        })
      ),
    };

    const recommendation: RepoContextRecommendation | null = recRows[0]
      ? {
          repo_id: recRows[0].repo_id,
          repo_key: recRows[0].repo_key,
          recommended_max_duration_min:
            recRows[0].recommended_max_duration_min,
          confidence: recRows[0].confidence,
          sample_size: recRows[0].sample_size,
          reasoning: recRows[0].reasoning,
        }
      : null;

    return NextResponse.json({ period, summary, recommendation });
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
    console.error("Repo context-health error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

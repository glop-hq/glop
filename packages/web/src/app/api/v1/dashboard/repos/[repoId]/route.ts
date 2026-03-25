import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dashboardQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { AnalyticsPeriod, RepoDashboardResponse } from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return round1(((current - prev) / prev) * 100);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const session = await requireSession();
    const { repoId } = await params;
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

    const prevPeriodEnd = new Date(periodStart);
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - days);

    // Verify repo belongs to workspace
    const repoRows = await db
      .select({
        id: schema.repos.id,
        repo_key: schema.repos.repo_key,
        display_name: schema.repos.display_name,
        language: schema.repos.language,
      })
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.id, repoId),
          eq(schema.repos.workspace_id, workspace_id)
        )
      )
      .limit(1);

    if (repoRows.length === 0) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    const repo = repoRows[0];

    const baseWhere = and(
      eq(schema.runs.repo_id, repoId),
      eq(schema.runs.workspace_id, workspace_id),
      sql`${schema.runs.started_at} >= ${periodStartStr}`
    );

    const prevWhere = and(
      eq(schema.runs.repo_id, repoId),
      eq(schema.runs.workspace_id, workspace_id),
      sql`${schema.runs.started_at} >= ${prevPeriodStart.toISOString()}`,
      sql`${schema.runs.started_at} < ${prevPeriodEnd.toISOString()}`
    );

    const [
      summaryRows,
      commitCountRows,
      prCountRows,
      readinessRows,
      developerRows,
      frictionRows,
      successRows,
      timelineRows,
      prevSessionRows,
      sparklineRows,
    ] = await Promise.all([
      // 1. Summary: sessions + distinct developers
      db
        .select({
          sessions: sql<number>`count(*)::int`,
          developers: sql<number>`count(distinct ${schema.runs.developer_entity_id})::int`,
        })
        .from(schema.runs)
        .where(baseWhere),

      // 2. Commit count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(baseWhere, sql`${schema.artifacts.artifact_type} = 'commit'`)
        ),

      // 3. PR count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(baseWhere, sql`${schema.artifacts.artifact_type} = 'pr'`)
        ),

      // 4. Latest readiness score + permission health
      db
        .select({
          score: schema.repo_scans.score,
          permission_health_score: schema.repo_scans.permission_health_score,
        })
        .from(schema.repo_scans)
        .where(
          and(
            eq(schema.repo_scans.repo_id, repoId),
            sql`${schema.repo_scans.status} = 'completed'`
          )
        )
        .orderBy(sql`${schema.repo_scans.created_at} DESC`)
        .limit(1),

      // 5. Developer breakdown
      db
        .select({
          developer_id: schema.runs.developer_entity_id,
          display_name: schema.developers.display_name,
          email: schema.developers.email,
          avatar_url: schema.developers.avatar_url,
          sessions: sql<number>`count(*)::int`,
          last_active: sql<string>`max(${schema.runs.started_at})::text`,
        })
        .from(schema.runs)
        .leftJoin(
          schema.developers,
          eq(schema.developers.id, schema.runs.developer_entity_id)
        )
        .where(baseWhere)
        .groupBy(
          schema.runs.developer_entity_id,
          schema.developers.display_name,
          schema.developers.email,
          schema.developers.avatar_url
        )
        .orderBy(sql`count(*) DESC`),

      // 6. Friction from session_facets
      db
        .select({
          friction_counts: schema.session_facets.friction_counts,
        })
        .from(schema.session_facets)
        .where(
          and(
            eq(schema.session_facets.repo_id, repoId),
            eq(schema.session_facets.workspace_id, workspace_id),
            sql`${schema.session_facets.created_at} >= ${periodStartStr}`
          )
        ),

      // 7. Success patterns
      db
        .select({
          primary_success: schema.session_facets.primary_success,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.session_facets)
        .where(
          and(
            eq(schema.session_facets.repo_id, repoId),
            eq(schema.session_facets.workspace_id, workspace_id),
            sql`${schema.session_facets.created_at} >= ${periodStartStr}`,
            sql`${schema.session_facets.primary_success} IS NOT NULL`
          )
        )
        .groupBy(schema.session_facets.primary_success)
        .orderBy(sql`count(*) DESC`)
        .limit(5),

      // 8. Activity timeline (sessions per day)
      db
        .select({
          date: sql<string>`date_trunc('day', ${schema.runs.started_at})::date::text`,
          sessions: sql<number>`count(*)::int`,
        })
        .from(schema.runs)
        .where(baseWhere)
        .groupBy(sql`date_trunc('day', ${schema.runs.started_at})`)
        .orderBy(sql`date_trunc('day', ${schema.runs.started_at})`),

      // 9. Prev period sessions (for change %)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.runs)
        .where(prevWhere),

      // 10. Sparkline data — per developer, sessions per day (last 14 days)
      db
        .select({
          developer_id: schema.runs.developer_entity_id,
          date: sql<string>`date_trunc('day', ${schema.runs.started_at})::date::text`,
          sessions: sql<number>`count(*)::int`,
        })
        .from(schema.runs)
        .where(
          and(
            eq(schema.runs.repo_id, repoId),
            eq(schema.runs.workspace_id, workspace_id),
            sql`${schema.runs.started_at} >= ${new Date(Date.now() - 14 * 86400000).toISOString()}`
          )
        )
        .groupBy(
          schema.runs.developer_entity_id,
          sql`date_trunc('day', ${schema.runs.started_at})`
        ),
    ]);

    // Build per-developer commit/PR counts
    const devCommitCounts = new Map<string, number>();
    const devPrCounts = new Map<string, number>();
    if (developerRows.length > 0) {
      const devIds = developerRows
        .map((d) => d.developer_id)
        .filter(Boolean) as string[];
      if (devIds.length > 0) {
        const [devCommits, devPrs] = await Promise.all([
          db
            .select({
              developer_id: schema.runs.developer_entity_id,
              count: sql<number>`count(*)::int`,
            })
            .from(schema.artifacts)
            .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
            .where(
              and(
                baseWhere,
                sql`${schema.artifacts.artifact_type} = 'commit'`
              )
            )
            .groupBy(schema.runs.developer_entity_id),
          db
            .select({
              developer_id: schema.runs.developer_entity_id,
              count: sql<number>`count(*)::int`,
            })
            .from(schema.artifacts)
            .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
            .where(
              and(
                baseWhere,
                sql`${schema.artifacts.artifact_type} = 'pr'`
              )
            )
            .groupBy(schema.runs.developer_entity_id),
        ]);
        for (const r of devCommits) {
          if (r.developer_id) devCommitCounts.set(r.developer_id, Number(r.count));
        }
        for (const r of devPrs) {
          if (r.developer_id) devPrCounts.set(r.developer_id, Number(r.count));
        }
      }
    }

    // Build sparkline data
    const sparklineMap = new Map<string, Map<string, number>>();
    for (const row of sparklineRows) {
      if (!row.developer_id) continue;
      const devMap = sparklineMap.get(row.developer_id) ?? new Map();
      devMap.set(row.date, Number(row.sessions));
      sparklineMap.set(row.developer_id, devMap);
    }

    // Generate 14-day date range
    const sparklineDates: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      sparklineDates.push(d.toISOString().slice(0, 10));
    }

    // Aggregate friction counts
    const frictionAgg = new Map<string, number>();
    for (const row of frictionRows) {
      const counts = row.friction_counts as Record<string, number> | null;
      if (!counts) continue;
      for (const [cat, count] of Object.entries(counts)) {
        frictionAgg.set(cat, (frictionAgg.get(cat) ?? 0) + count);
      }
    }

    const response: RepoDashboardResponse = {
      repo: {
        id: repo.id,
        repo_key: repo.repo_key,
        display_name: repo.display_name,
        language: repo.language,
      },
      summary: {
        sessions: Number(summaryRows[0]?.sessions ?? 0),
        developers: Number(summaryRows[0]?.developers ?? 0),
        readiness_score: readinessRows[0]?.score ?? null,
        permission_health_score: readinessRows[0]?.permission_health_score ?? null,
        commits: Number(commitCountRows[0]?.count ?? 0),
        prs: Number(prCountRows[0]?.count ?? 0),
        sessions_change: pctChange(
          Number(summaryRows[0]?.sessions ?? 0),
          Number(prevSessionRows[0]?.count ?? 0)
        ),
      },
      developer_breakdown: developerRows.map((d) => ({
        developer_id: d.developer_id ?? "",
        display_name: d.display_name ?? "Unknown",
        email: d.email,
        avatar_url: d.avatar_url,
        sessions: Number(d.sessions),
        commits: devCommitCounts.get(d.developer_id ?? "") ?? 0,
        prs: devPrCounts.get(d.developer_id ?? "") ?? 0,
        last_active: d.last_active,
        sparkline: sparklineDates.map(
          (date) =>
            sparklineMap.get(d.developer_id ?? "")?.get(date) ?? 0
        ),
      })),
      friction_summary: Array.from(frictionAgg.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      success_patterns: successRows
        .filter((r) => r.primary_success)
        .map((r) => r.primary_success!),
      activity_timeline: timelineRows.map((r) => ({
        date: r.date,
        sessions: Number(r.sessions),
      })),
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
    console.error("Repo dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

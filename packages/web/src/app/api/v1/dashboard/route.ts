import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dashboardQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { AnalyticsPeriod, DashboardResponse } from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function getPeriodDates(period: AnalyticsPeriod) {
  const days = PERIOD_DAYS[period];
  const now = new Date();

  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);
  periodStart.setHours(0, 0, 0, 0);

  const prevPeriodEnd = new Date(periodStart);
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days);

  return {
    days,
    periodStart: periodStart.toISOString(),
    prevPeriodStart: prevPeriodStart.toISOString(),
    prevPeriodEnd: prevPeriodEnd.toISOString(),
    periodStartDate: periodStart,
  };
}

function fillDateGaps(
  rows: { date: string; active_developers: number; sessions: number }[],
  periodStart: Date
) {
  const map = new Map(rows.map((r) => [r.date, r]));
  const result: { date: string; active_developers: number; sessions: number }[] = [];
  const current = new Date(periodStart);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (current <= today) {
    const dateStr = current.toISOString().slice(0, 10);
    const row = map.get(dateStr);
    result.push({
      date: dateStr,
      active_developers: row?.active_developers ?? 0,
      sessions: row?.sessions ?? 0,
    });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return current > 0 ? 100 : null;
  return round1(((current - prev) / prev) * 100);
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
    const { periodStart, prevPeriodStart, prevPeriodEnd, periodStartDate } =
      getPeriodDates(period);

    // ── Current period queries ──
    const baseWhere = and(
      eq(schema.runs.workspace_id, workspace_id),
      sql`${schema.runs.started_at} >= ${periodStart}`
    );

    const prevWhere = and(
      eq(schema.runs.workspace_id, workspace_id),
      sql`${schema.runs.started_at} >= ${prevPeriodStart}`,
      sql`${schema.runs.started_at} < ${prevPeriodEnd}`
    );

    const [
      // Current period
      activeDevelopers,
      activeRepos,
      totalSessions,
      effectivenessRows,
      readinessRows,
      aiCommitsRows,
      aiPrsRows,
      adoptionTrendRows,
      activityByRepoRows,
      sessionOutcomeRows,
      repoHeatmapRows,
      // Previous period
      prevActiveDevelopers,
      prevActiveRepos,
      prevTotalSessions,
      prevEffectivenessRows,
      prevAiCommitsRows,
      prevAiPrsRows,
    ] = await Promise.all([
      // 1. Active developers
      db
        .select({
          count: sql<number>`count(distinct ${schema.runs.developer_entity_id})::int`,
        })
        .from(schema.runs)
        .where(baseWhere),

      // 2. Active repos
      db
        .select({
          count: sql<number>`count(distinct ${schema.runs.repo_id})::int`,
        })
        .from(schema.runs)
        .where(baseWhere),

      // 3. Total sessions
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.runs)
        .where(baseWhere),

      // 4. Effectiveness from session_facets
      db
        .select({
          total: sql<number>`count(*)::int`,
          effective: sql<number>`count(*) FILTER (WHERE ${schema.session_facets.outcome} IN ('fully_achieved', 'mostly_achieved'))::int`,
        })
        .from(schema.session_facets)
        .where(
          and(
            eq(schema.session_facets.workspace_id, workspace_id),
            sql`${schema.session_facets.created_at} >= ${periodStart}`
          )
        ),

      // 5. Avg readiness — latest scan per active repo
      db
        .select({
          avg_score: sql<number>`avg(sub.score)`,
        })
        .from(
          sql`(
            SELECT DISTINCT ON (rs.repo_id) rs.score
            FROM repo_scans rs
            INNER JOIN runs r ON r.repo_id = rs.repo_id
            WHERE r.workspace_id = ${workspace_id}
              AND r.started_at >= ${periodStart}
              AND rs.status = 'completed'
            ORDER BY rs.repo_id, rs.created_at DESC
          ) sub`
        ),

      // 6. AI commits
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(
            baseWhere,
            sql`${schema.artifacts.artifact_type} = 'commit'`
          )
        ),

      // 7. AI PRs
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(
            baseWhere,
            sql`${schema.artifacts.artifact_type} = 'pr'`
          )
        ),

      // 8. Adoption trend — daily active devs + sessions
      db
        .select({
          date: sql<string>`date_trunc('day', ${schema.runs.started_at})::date::text`,
          active_developers: sql<number>`count(distinct ${schema.runs.developer_entity_id})::int`,
          sessions: sql<number>`count(*)::int`,
        })
        .from(schema.runs)
        .where(baseWhere)
        .groupBy(sql`date_trunc('day', ${schema.runs.started_at})`)
        .orderBy(sql`date_trunc('day', ${schema.runs.started_at})`),

      // 9. Activity by repo — top 10 repos, grouped by day
      db
        .select({
          date: sql<string>`date_trunc('day', ${schema.runs.started_at})::date::text`,
          repo_key: schema.runs.repo_key,
          repo_id: sql<string>`${schema.runs.repo_id}::text`,
          sessions: sql<number>`count(*)::int`,
        })
        .from(schema.runs)
        .where(
          and(
            baseWhere,
            sql`${schema.runs.repo_id} IN (
              SELECT repo_id FROM runs
              WHERE workspace_id = ${workspace_id}
                AND started_at >= ${periodStart}
              GROUP BY repo_id
              ORDER BY count(*) DESC
              LIMIT 10
            )`
          )
        )
        .groupBy(
          sql`date_trunc('day', ${schema.runs.started_at})`,
          schema.runs.repo_key,
          schema.runs.repo_id
        )
        .orderBy(sql`date_trunc('day', ${schema.runs.started_at})`),

      // 10. Session outcome distribution
      db
        .select({
          outcome: schema.session_facets.outcome,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.session_facets)
        .where(
          and(
            eq(schema.session_facets.workspace_id, workspace_id),
            sql`${schema.session_facets.created_at} >= ${periodStart}`
          )
        )
        .groupBy(schema.session_facets.outcome),

      // 11. Repo heatmap — sessions by (repo, date)
      db
        .select({
          repo_key: schema.runs.repo_key,
          repo_id: sql<string>`${schema.runs.repo_id}::text`,
          date: sql<string>`date_trunc('day', ${schema.runs.started_at})::date::text`,
          sessions: sql<number>`count(*)::int`,
        })
        .from(schema.runs)
        .where(baseWhere)
        .groupBy(
          schema.runs.repo_key,
          schema.runs.repo_id,
          sql`date_trunc('day', ${schema.runs.started_at})`
        ),

      // ── Previous period ──

      // Prev active developers
      db
        .select({
          count: sql<number>`count(distinct ${schema.runs.developer_entity_id})::int`,
        })
        .from(schema.runs)
        .where(prevWhere),

      // Prev active repos
      db
        .select({
          count: sql<number>`count(distinct ${schema.runs.repo_id})::int`,
        })
        .from(schema.runs)
        .where(prevWhere),

      // Prev total sessions
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.runs)
        .where(prevWhere),

      // Prev effectiveness
      db
        .select({
          total: sql<number>`count(*)::int`,
          effective: sql<number>`count(*) FILTER (WHERE ${schema.session_facets.outcome} IN ('fully_achieved', 'mostly_achieved'))::int`,
        })
        .from(schema.session_facets)
        .where(
          and(
            eq(schema.session_facets.workspace_id, workspace_id),
            sql`${schema.session_facets.created_at} >= ${prevPeriodStart}`,
            sql`${schema.session_facets.created_at} < ${prevPeriodEnd}`
          )
        ),

      // Prev AI commits
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(
            prevWhere,
            sql`${schema.artifacts.artifact_type} = 'commit'`
          )
        ),

      // Prev AI PRs
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(
            prevWhere,
            sql`${schema.artifacts.artifact_type} = 'pr'`
          )
        ),
    ]);

    const curDevs = Number(activeDevelopers[0]?.count ?? 0);
    const curRepos = Number(activeRepos[0]?.count ?? 0);
    const curSessions = Number(totalSessions[0]?.count ?? 0);
    const effTotal = Number(effectivenessRows[0]?.total ?? 0);
    const effGood = Number(effectivenessRows[0]?.effective ?? 0);
    const curEffectiveness = effTotal > 0 ? round1((effGood / effTotal) * 100) : 0;
    const curReadiness = readinessRows[0]?.avg_score != null
      ? round1(Number(readinessRows[0].avg_score))
      : null;
    const curCommits = Number(aiCommitsRows[0]?.count ?? 0);
    const curPrs = Number(aiPrsRows[0]?.count ?? 0);

    const prevDevs = Number(prevActiveDevelopers[0]?.count ?? 0);
    const prevRepos = Number(prevActiveRepos[0]?.count ?? 0);
    const prevSessions = Number(prevTotalSessions[0]?.count ?? 0);
    const prevEffTotal = Number(prevEffectivenessRows[0]?.total ?? 0);
    const prevEffGood = Number(prevEffectivenessRows[0]?.effective ?? 0);
    const prevEffectiveness = prevEffTotal > 0 ? round1((prevEffGood / prevEffTotal) * 100) : 0;
    const prevCommits = Number(prevAiCommitsRows[0]?.count ?? 0);
    const prevPrs = Number(prevAiPrsRows[0]?.count ?? 0);

    const response: DashboardResponse = {
      period: period,
      summary: {
        active_developers: curDevs,
        active_repos: curRepos,
        total_sessions: curSessions,
        avg_effectiveness: curEffectiveness,
        avg_readiness: curReadiness,
        ai_commits: curCommits,
        ai_prs: curPrs,
        active_developers_change: pctChange(curDevs, prevDevs),
        active_repos_change: pctChange(curRepos, prevRepos),
        total_sessions_change: pctChange(curSessions, prevSessions),
        avg_effectiveness_change: pctChange(curEffectiveness, prevEffectiveness),
        ai_commits_change: pctChange(curCommits, prevCommits),
        ai_prs_change: pctChange(curPrs, prevPrs),
      },
      adoption_trend: fillDateGaps(
        adoptionTrendRows.map((r) => ({
          date: r.date,
          active_developers: Number(r.active_developers),
          sessions: Number(r.sessions),
        })),
        periodStartDate
      ),
      activity_by_repo: activityByRepoRows.map((r) => ({
        date: r.date,
        repo_key: r.repo_key,
        repo_id: r.repo_id,
        sessions: Number(r.sessions),
      })),
      session_outcomes: sessionOutcomeRows
        .filter((r) => r.outcome != null)
        .map((r) => ({
          outcome: r.outcome!,
          count: Number(r.count),
        })),
      repo_heatmap: repoHeatmapRows.map((r) => ({
        repo_key: r.repo_key,
        repo_id: r.repo_id,
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
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

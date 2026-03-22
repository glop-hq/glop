import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dashboardQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { AnalyticsPeriod, ContributionsResponse } from "@glop/shared";

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

    const prevPeriodEnd = new Date(periodStart);
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - days);

    const baseWhere = and(
      eq(schema.runs.workspace_id, workspace_id),
      sql`${schema.runs.started_at} >= ${periodStartStr}`
    );

    const prevWhere = and(
      eq(schema.runs.workspace_id, workspace_id),
      sql`${schema.runs.started_at} >= ${prevPeriodStart.toISOString()}`,
      sql`${schema.runs.started_at} < ${prevPeriodEnd.toISOString()}`
    );

    const [
      repoContribRows,
      totalCommitsRows,
      totalPrsRows,
      sessionsWithCommitsRows,
      totalSessionsRows,
      prevCommitsRows,
      prevPrsRows,
    ] = await Promise.all([
      // Per-repo: commits, PRs, sessions, sessions with commits
      db
        .select({
          repo_id: sql<string>`${schema.runs.repo_id}::text`,
          repo_key: schema.runs.repo_key,
          display_name: schema.repos.display_name,
          ai_commits: sql<number>`count(*) FILTER (WHERE ${schema.artifacts.artifact_type} = 'commit')::int`,
          ai_prs: sql<number>`count(*) FILTER (WHERE ${schema.artifacts.artifact_type} = 'pr')::int`,
          sessions: sql<number>`count(distinct ${schema.runs.id})::int`,
          sessions_with_commits: sql<number>`count(distinct ${schema.runs.id}) FILTER (WHERE ${schema.artifacts.artifact_type} = 'commit')::int`,
        })
        .from(schema.runs)
        .leftJoin(schema.repos, eq(schema.repos.id, schema.runs.repo_id))
        .leftJoin(
          schema.artifacts,
          and(
            eq(schema.artifacts.run_id, schema.runs.id),
            sql`${schema.artifacts.artifact_type} IN ('commit', 'pr')`
          )
        )
        .where(baseWhere)
        .groupBy(schema.runs.repo_id, schema.runs.repo_key, schema.repos.display_name)
        .orderBy(sql`count(*) FILTER (WHERE ${schema.artifacts.artifact_type} = 'commit') DESC`),

      // Total AI commits
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(baseWhere, sql`${schema.artifacts.artifact_type} = 'commit'`)
        ),

      // Total AI PRs
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(baseWhere, sql`${schema.artifacts.artifact_type} = 'pr'`)
        ),

      // Sessions with at least one commit
      db
        .select({
          count: sql<number>`count(distinct ${schema.runs.id})::int`,
        })
        .from(schema.runs)
        .innerJoin(
          schema.artifacts,
          and(
            eq(schema.artifacts.run_id, schema.runs.id),
            sql`${schema.artifacts.artifact_type} = 'commit'`
          )
        )
        .where(baseWhere),

      // Total sessions
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.runs)
        .where(baseWhere),

      // Prev period commits
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(prevWhere, sql`${schema.artifacts.artifact_type} = 'commit'`)
        ),

      // Prev period PRs
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.artifacts)
        .innerJoin(schema.runs, eq(schema.runs.id, schema.artifacts.run_id))
        .where(
          and(prevWhere, sql`${schema.artifacts.artifact_type} = 'pr'`)
        ),
    ]);

    const curCommits = Number(totalCommitsRows[0]?.count ?? 0);
    const curPrs = Number(totalPrsRows[0]?.count ?? 0);
    const prevCommits = Number(prevCommitsRows[0]?.count ?? 0);
    const prevPrs = Number(prevPrsRows[0]?.count ?? 0);

    const response: ContributionsResponse = {
      period,
      summary: {
        total_ai_commits: curCommits,
        total_ai_prs: curPrs,
        sessions_with_commits: Number(sessionsWithCommitsRows[0]?.count ?? 0),
        total_sessions: Number(totalSessionsRows[0]?.count ?? 0),
        ai_commits_change: pctChange(curCommits, prevCommits),
        ai_prs_change: pctChange(curPrs, prevPrs),
      },
      by_repo: repoContribRows.map((r) => ({
        repo_id: r.repo_id,
        repo_key: r.repo_key,
        display_name: r.display_name,
        ai_commits: Number(r.ai_commits),
        ai_prs: Number(r.ai_prs),
        sessions: Number(r.sessions),
        sessions_with_commits: Number(r.sessions_with_commits),
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
    console.error("Contributions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

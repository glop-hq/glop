import { NextRequest, NextResponse } from "next/server";
import { sql, inArray, and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { analyticsQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import type { AnalyticsResponse, AnalyticsPeriod } from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function getPeriodStart(period: AnalyticsPeriod): Date {
  const now = new Date();
  now.setDate(now.getDate() - PERIOD_DAYS[period]);
  now.setHours(0, 0, 0, 0);
  return now;
}

function fillDateGaps(
  rows: { date: string; completed: number; failed: number }[],
  periodStart: Date
): { date: string; completed: number; failed: number; total: number }[] {
  const map = new Map(rows.map((r) => [r.date, r]));
  const result: {
    date: string;
    completed: number;
    failed: number;
    total: number;
  }[] = [];

  const current = new Date(periodStart);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  while (current <= today) {
    const dateStr = current.toISOString().slice(0, 10);
    const row = map.get(dateStr);
    const completed = row?.completed ?? 0;
    const failed = row?.failed ?? 0;
    result.push({ date: dateStr, completed, failed, total: completed + failed });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const searchParams = request.nextUrl.searchParams;

    const parsed = analyticsQuerySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
      user_id: searchParams.get("user_id") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { period, user_id } = parsed.data as {
      period: AnalyticsPeriod;
      user_id?: string;
    };
    const db = getDb();

    const allWorkspaceIds = session.workspaces.map((w) => w.id);
    if (allWorkspaceIds.length === 0) {
      return NextResponse.json(emptyResponse(period));
    }

    const requestedId = searchParams.get("workspace_id");
    const workspaceIds =
      requestedId && allWorkspaceIds.includes(requestedId)
        ? [requestedId]
        : allWorkspaceIds;

    const periodStart = getPeriodStart(period);
    const periodStartStr = periodStart.toISOString();

    const baseFilter = and(
      inArray(schema.runs.workspace_id, workspaceIds),
      sql`${schema.runs.started_at} >= ${periodStartStr}`,
      sql`${schema.runs.owner_user_id} IS NOT NULL`,
      ...(user_id
        ? [sql`${schema.runs.owner_user_id} = ${user_id}`]
        : [])
    );

    const runsJoinFilter = and(
      inArray(schema.runs.workspace_id, workspaceIds),
      sql`${schema.runs.started_at} >= ${periodStartStr}`,
      sql`${schema.runs.owner_user_id} IS NOT NULL`,
      ...(user_id
        ? [sql`${schema.runs.owner_user_id} = ${user_id}`]
        : [])
    );

    // Run all queries in parallel
    const [
      summaryRows,
      runsPerDayRows,
      turnsPerRunRows,
      artifactRows,
      linesChangedRows,
      firstCommitRows,
      eventTimestampRows,
      compactionsPerRunRows,
      recentRunRows,
      topRepoRows,
      activityRows,
      busiestHoursRows,
      developersRows
    ] = await Promise.all([
      // 1. Summary
      db
        .select({
          total_runs: sql<number>`count(*)`,
          completed_runs: sql<number>`count(*) FILTER (WHERE ${schema.runs.status} = 'completed')`,
          failed_runs: sql<number>`count(*) FILTER (WHERE ${schema.runs.status} = 'failed')`,
        })
        .from(schema.runs)
        .where(baseFilter),

      // 2. Runs per day
      db
        .select({
          date: sql<string>`date_trunc('day', ${schema.runs.started_at})::date::text`,
          completed: sql<number>`count(*) FILTER (WHERE ${schema.runs.status} = 'completed')`,
          failed: sql<number>`count(*) FILTER (WHERE ${schema.runs.status} = 'failed')`,
        })
        .from(schema.runs)
        .where(baseFilter)
        .groupBy(sql`date_trunc('day', ${schema.runs.started_at})`)
        .orderBy(sql`date_trunc('day', ${schema.runs.started_at})`),

      // 3. Conversation turns per run
      db
        .select({
          run_id: schema.events.run_id,
          turn_count: sql<number>`count(*)`,
        })
        .from(schema.events)
        .innerJoin(schema.runs, sql`${schema.runs.id} = ${schema.events.run_id}`)
        .where(
          and(
            runsJoinFilter,
            inArray(schema.events.event_type, ["run.prompt", "run.response"])
          )
        )
        .groupBy(schema.events.run_id),

      // 4. Artifacts per run (with type)
      db
        .select({
          run_id: schema.artifacts.run_id,
          artifact_type: schema.artifacts.artifact_type,
          artifact_count: sql<number>`count(*)`,
        })
        .from(schema.artifacts)
        .innerJoin(schema.runs, sql`${schema.runs.id} = ${schema.artifacts.run_id}`)
        .where(
          and(
            runsJoinFilter,
            inArray(schema.artifacts.artifact_type, ["commit", "pr"])
          )
        )
        .groupBy(schema.artifacts.run_id, schema.artifacts.artifact_type),

      // 4b. Lines changed per run (from commit artifact metadata)
      db
        .select({
          run_id: schema.artifacts.run_id,
          lines_changed: sql<number>`coalesce(sum(
            (${schema.artifacts.metadata}->>'lines_added')::int +
            (${schema.artifacts.metadata}->>'lines_removed')::int
          ), 0)`,
        })
        .from(schema.artifacts)
        .innerJoin(schema.runs, sql`${schema.runs.id} = ${schema.artifacts.run_id}`)
        .where(
          and(
            runsJoinFilter,
            sql`${schema.artifacts.artifact_type} = 'commit'`,
            sql`${schema.artifacts.metadata}->>'lines_added' IS NOT NULL`
          )
        )
        .groupBy(schema.artifacts.run_id),

      // 5. First commit timestamp per run
      db
        .select({
          run_id: schema.artifacts.run_id,
          first_commit_at: sql<string>`min(${schema.artifacts.created_at})`,
        })
        .from(schema.artifacts)
        .innerJoin(schema.runs, sql`${schema.runs.id} = ${schema.artifacts.run_id}`)
        .where(
          and(
            runsJoinFilter,
            sql`${schema.artifacts.artifact_type} = 'commit'`
          )
        )
        .groupBy(schema.artifacts.run_id),

      // 6. Event timestamps for prompt/response events (for turns-before-commit calc)
      db
        .select({
          run_id: schema.events.run_id,
          occurred_at: schema.events.occurred_at,
        })
        .from(schema.events)
        .innerJoin(schema.runs, sql`${schema.runs.id} = ${schema.events.run_id}`)
        .where(
          and(
            runsJoinFilter,
            inArray(schema.events.event_type, ["run.prompt", "run.response"]),
            sql`EXISTS (SELECT 1 FROM artifacts a WHERE a.run_id = ${schema.events.run_id} AND a.artifact_type = 'commit')`
          )
        ),

      // 7. Compactions per run
      db
        .select({
          run_id: schema.events.run_id,
          compaction_count: sql<number>`count(*)`,
        })
        .from(schema.events)
        .innerJoin(schema.runs, sql`${schema.runs.id} = ${schema.events.run_id}`)
        .where(
          and(
            runsJoinFilter,
            sql`${schema.events.event_type} = 'run.context_compacted'`
          )
        )
        .groupBy(schema.events.run_id),

      // 8. Recent runs for per-run breakdown
      db
        .select({
          run_id: schema.runs.id,
          label: sql<string>`coalesce(${schema.runs.title}, ${schema.runs.slug}, left(${schema.runs.id}::text, 8))`,
          started_at: schema.runs.started_at,
          developer_name: sql<string>`coalesce(${schema.users.name}, ${schema.users.email})`,
          repo_key: schema.runs.repo_key,
        })
        .from(schema.runs)
        .innerJoin(schema.users, eq(schema.runs.owner_user_id, schema.users.id))
        .where(baseFilter)
        .orderBy(sql`${schema.runs.started_at} DESC`)
        .limit(30),

      // 9. Top repos
      db
        .select({
          repo_key: schema.runs.repo_key,
          run_count: sql<number>`count(*)`,
        })
        .from(schema.runs)
        .where(baseFilter)
        .groupBy(schema.runs.repo_key)
        .orderBy(sql`count(*) DESC`)
        .limit(10),

      // 9. Activity breakdown
      db
        .select({
          activity_kind: sql<string>`${schema.runs.activity_kind}::text`,
          count: sql<number>`count(*)`,
        })
        .from(schema.runs)
        .where(baseFilter)
        .groupBy(schema.runs.activity_kind)
        .orderBy(sql`count(*) DESC`),

      // 10. Busiest hours
      db
        .select({
          hour: sql<number>`extract(hour from ${schema.runs.started_at})`,
          run_count: sql<number>`count(*)`,
        })
        .from(schema.runs)
        .where(baseFilter)
        .groupBy(sql`extract(hour from ${schema.runs.started_at})`)
        .orderBy(sql`extract(hour from ${schema.runs.started_at})`),

      // 11. Distinct developers for filter dropdown (unfiltered by user)
      db
        .select({
          user_id: schema.runs.owner_user_id,
          developer_name: sql<string>`coalesce(${schema.users.name}, ${schema.users.email})`,
        })
        .from(schema.runs)
        .innerJoin(schema.users, eq(schema.runs.owner_user_id, schema.users.id))
        .where(
          and(
            inArray(schema.runs.workspace_id, workspaceIds),
            sql`${schema.runs.started_at} >= ${periodStartStr}`,
            sql`${schema.runs.owner_user_id} IS NOT NULL`
          )
        )
        .groupBy(schema.runs.owner_user_id, schema.users.name, schema.users.email)
        .orderBy(sql`coalesce(${schema.users.name}, ${schema.users.email})`),
    ]);

    const summary = summaryRows[0];
    const totalRuns = Number(summary?.total_runs ?? 0);
    const completedRuns = Number(summary?.completed_runs ?? 0);
    const failedRuns = Number(summary?.failed_runs ?? 0);
    const days = PERIOD_DAYS[period];

    // Build lookup maps
    const turnsByRun = new Map(
      turnsPerRunRows.map((r) => [r.run_id, Number(r.turn_count)])
    );

    const commitsByRun = new Map<string, number>();
    const prsByRun = new Map<string, number>();
    for (const row of artifactRows) {
      const count = Number(row.artifact_count);
      if (row.artifact_type === "commit") {
        commitsByRun.set(row.run_id, (commitsByRun.get(row.run_id) ?? 0) + count);
      } else {
        prsByRun.set(row.run_id, (prsByRun.get(row.run_id) ?? 0) + count);
      }
    }

    const linesChangedByRun = new Map(
      linesChangedRows.map((r) => [r.run_id, Number(r.lines_changed)])
    );

    const compactionsByRun = new Map(
      compactionsPerRunRows.map((r) => [r.run_id, Number(r.compaction_count)])
    );

    // Compute turns before first commit per run
    const firstCommitByRun = new Map(
      firstCommitRows.map((r) => [r.run_id, r.first_commit_at])
    );
    const turnsBeforeCommitByRun = new Map<string, number>();
    for (const evt of eventTimestampRows) {
      const firstCommit = firstCommitByRun.get(evt.run_id);
      if (firstCommit && evt.occurred_at < firstCommit) {
        turnsBeforeCommitByRun.set(
          evt.run_id,
          (turnsBeforeCommitByRun.get(evt.run_id) ?? 0) + 1
        );
      }
    }

    // Compute aggregate metrics
    const totalTurns = Array.from(turnsByRun.values()).reduce((a, b) => a + b, 0);
    const totalCommits = Array.from(commitsByRun.values()).reduce((a, b) => a + b, 0);
    const totalPrs = Array.from(prsByRun.values()).reduce((a, b) => a + b, 0);
    const totalCompactions = Array.from(compactionsByRun.values()).reduce((a, b) => a + b, 0);

    const totalTurnsBeforeCommit = Array.from(turnsBeforeCommitByRun.values()).reduce(
      (a, b) => a + b,
      0
    );
    const runsWithCommits = turnsBeforeCommitByRun.size;

    const response: AnalyticsResponse = {
      period,
      summary: {
        total_runs: totalRuns,
        completed_runs: completedRuns,
        failed_runs: failedRuns,
        avg_conversation_turns: totalRuns > 0 ? round1(totalTurns / totalRuns) : 0,
        avg_turns_before_first_commit:
          runsWithCommits > 0 ? round1(totalTurnsBeforeCommit / runsWithCommits) : 0,
        commits_per_run: totalRuns > 0 ? round1(totalCommits / totalRuns) : 0,
        prs_per_run: totalRuns > 0 ? round1(totalPrs / totalRuns) : 0,
        compactions_per_run: totalRuns > 0 ? round1(totalCompactions / totalRuns) : 0,
        runs_per_day: round1(totalRuns / days),
      },
      runs_per_day: fillDateGaps(
        runsPerDayRows.map((r) => ({
          date: r.date,
          completed: Number(r.completed),
          failed: Number(r.failed),
        })),
        periodStart
      ),
      run_breakdown: recentRunRows
        .map((r) => ({
          run_id: r.run_id,
          label: r.label,
          started_at: r.started_at,
          developer_name: r.developer_name,
          repo_key: r.repo_key,
          conversation_turns: turnsByRun.get(r.run_id) ?? 0,
          commits: commitsByRun.get(r.run_id) ?? 0,
          lines_changed: linesChangedByRun.get(r.run_id) ?? 0,
          prs: prsByRun.get(r.run_id) ?? 0,
          compactions: compactionsByRun.get(r.run_id) ?? 0,
        }))
        .reverse(),
      developers: developersRows.map((r) => ({
        user_id: r.user_id!,
        developer_name: r.developer_name,
      })),
      top_repos: topRepoRows.map((r) => ({
        repo_key: r.repo_key,
        run_count: Number(r.run_count),
      })),
      activity_breakdown: activityRows.map((r) => ({
        activity_kind: r.activity_kind,
        count: Number(r.count),
      })),
      busiest_hours: fillHourGaps(
        busiestHoursRows.map((r) => ({
          hour: Number(r.hour),
          run_count: Number(r.run_count),
        }))
      ),
    };

    // Per-developer stats (always available)
    {
      const devMap = new Map<
        string,
        {
          runs: number;
          turns: number;
          commits: number;
          prs: number;
          compactions: number;
          turnsBeforeCommit: number;
          runsWithCommits: number;
        }
      >();

      for (const row of recentRunRows) {
        const entry = devMap.get(row.developer_name) ?? {
          runs: 0,
          turns: 0,
          commits: 0,
          prs: 0,
          compactions: 0,
          turnsBeforeCommit: 0,
          runsWithCommits: 0,
        };
        entry.runs += 1;
        entry.turns += turnsByRun.get(row.run_id) ?? 0;
        entry.commits += commitsByRun.get(row.run_id) ?? 0;
        entry.prs += prsByRun.get(row.run_id) ?? 0;
        entry.compactions += compactionsByRun.get(row.run_id) ?? 0;
        const tbc = turnsBeforeCommitByRun.get(row.run_id);
        if (tbc !== undefined) {
          entry.turnsBeforeCommit += tbc;
          entry.runsWithCommits += 1;
        }
        devMap.set(row.developer_name, entry);
      }

      response.developer_stats = Array.from(devMap.entries())
        .map(([name, s]) => ({
          developer_name: name,
          run_count: s.runs,
          avg_conversation_turns: s.runs > 0 ? round1(s.turns / s.runs) : 0,
          avg_turns_before_first_commit:
            s.runsWithCommits > 0
              ? round1(s.turnsBeforeCommit / s.runsWithCommits)
              : 0,
          commits_per_run: s.runs > 0 ? round1(s.commits / s.runs) : 0,
          prs_per_run: s.runs > 0 ? round1(s.prs / s.runs) : 0,
          compactions_per_run: s.runs > 0 ? round1(s.compactions / s.runs) : 0,
        }))
        .sort((a, b) => b.run_count - a.run_count);
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

function fillHourGaps(
  rows: { hour: number; run_count: number }[]
): { hour: number; run_count: number }[] {
  const map = new Map(rows.map((r) => [r.hour, r.run_count]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    run_count: map.get(hour) ?? 0,
  }));
}

function emptyResponse(period: AnalyticsPeriod): AnalyticsResponse {
  return {
    period,
    summary: {
      total_runs: 0,
      completed_runs: 0,
      failed_runs: 0,
      avg_conversation_turns: 0,
      avg_turns_before_first_commit: 0,
      commits_per_run: 0,
      prs_per_run: 0,
      compactions_per_run: 0,
      runs_per_day: 0,
    },
    runs_per_day: [],
    run_breakdown: [],
    developers: [],
    top_repos: [],
    activity_breakdown: [],
    busiest_hours: fillHourGaps([]),
  };
}

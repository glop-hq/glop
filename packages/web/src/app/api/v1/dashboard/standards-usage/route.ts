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
  StandardsUsageResponse,
  StandardUsageSummary,
  StandardUsageRow,
  StandardUsageTrendPoint,
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

    // Previous period for change calculation
    const prevPeriodStart = new Date(periodStart);
    prevPeriodStart.setDate(prevPeriodStart.getDate() - days);
    const prevPeriodStartStr = prevPeriodStart.toISOString();

    const baseWhere = and(
      eq(schema.standard_usage.workspace_id, workspace_id),
      sql`${schema.standard_usage.created_at} >= ${periodStartStr}`
    );

    const [summaryRows, prevSummaryRows, perStandardRows, trendRows, installedRows] =
      await Promise.all([
        // Current period summary
        db
          .select({
            total_invocations: sql<number>`count(*)::int`,
            active_standards: sql<number>`count(DISTINCT ${schema.standard_usage.standard_name})::int`,
          })
          .from(schema.standard_usage)
          .where(baseWhere),

        // Previous period summary for change calc
        db
          .select({
            total_invocations: sql<number>`count(*)::int`,
          })
          .from(schema.standard_usage)
          .where(
            and(
              eq(schema.standard_usage.workspace_id, workspace_id),
              sql`${schema.standard_usage.created_at} >= ${prevPeriodStartStr}`,
              sql`${schema.standard_usage.created_at} < ${periodStartStr}`
            )
          ),

        // Per-standard breakdown with effectiveness
        db
          .select({
            standard_name: schema.standard_usage.standard_name,
            standard_type: schema.standard_usage.standard_type,
            standard_id: sql<string | null>`max(${schema.standard_usage.standard_id}::text)`,
            invocation_count: sql<number>`count(*)::int`,
            unique_developers: sql<number>`count(DISTINCT ${schema.standard_usage.developer_entity_id})::int`,
            unique_repos: sql<number>`count(DISTINCT ${schema.standard_usage.repo_id})::int`,
            last_used_at: sql<string>`max(${schema.standard_usage.created_at})::text`,
            avg_outcome: sql<number>`avg(
              CASE
                WHEN ${schema.session_facets.outcome} = 'success' THEN 1.0
                WHEN ${schema.session_facets.outcome} = 'partial' THEN 0.5
                ELSE 0.0
              END
            ) FILTER (WHERE ${schema.session_facets.outcome} IS NOT NULL)`,
          })
          .from(schema.standard_usage)
          .leftJoin(
            schema.session_facets,
            eq(schema.standard_usage.run_id, schema.session_facets.run_id)
          )
          .where(baseWhere)
          .groupBy(
            schema.standard_usage.standard_name,
            schema.standard_usage.standard_type
          )
          .orderBy(sql`count(*) DESC`)
          .limit(50),

        // Weekly trend
        db
          .select({
            date: sql<string>`date_trunc('week', ${schema.standard_usage.created_at})::date::text`,
            invocations: sql<number>`count(*)::int`,
          })
          .from(schema.standard_usage)
          .where(baseWhere)
          .groupBy(
            sql`date_trunc('week', ${schema.standard_usage.created_at})`
          )
          .orderBy(
            sql`date_trunc('week', ${schema.standard_usage.created_at})`
          ),

        // Installed standards count from claude_items
        db
          .select({
            count: sql<number>`count(DISTINCT (${schema.claude_items.repo_id}, ${schema.claude_items.name}))::int`,
          })
          .from(schema.claude_items)
          .where(eq(schema.claude_items.workspace_id, workspace_id)),
      ]);

    const s = summaryRows[0];
    const ps = prevSummaryRows[0];
    const totalInvocations = Number(s?.total_invocations ?? 0);
    const prevInvocations = Number(ps?.total_invocations ?? 0);
    const activeStandards = Number(s?.active_standards ?? 0);
    const installedStandards = Number(installedRows[0]?.count ?? 0);

    const summary: StandardUsageSummary = {
      total_invocations: totalInvocations,
      active_standards: activeStandards,
      installed_standards: installedStandards,
      adoption_rate:
        installedStandards > 0
          ? round1((activeStandards / installedStandards) * 100)
          : 0,
      total_invocations_change:
        prevInvocations > 0
          ? round1(
              ((totalInvocations - prevInvocations) / prevInvocations) * 100
            )
          : null,
    };

    // Count installed repos per standard from claude_items
    const installedPerStandard = await db
      .select({
        name: schema.claude_items.name,
        installed_repos: sql<number>`count(DISTINCT ${schema.claude_items.repo_id})::int`,
      })
      .from(schema.claude_items)
      .where(eq(schema.claude_items.workspace_id, workspace_id))
      .groupBy(schema.claude_items.name);

    const installedMap = new Map(
      installedPerStandard.map((r) => [r.name, Number(r.installed_repos)])
    );

    const standards: StandardUsageRow[] = perStandardRows.map((r) => ({
      standard_id: r.standard_id ?? null,
      standard_name: r.standard_name,
      standard_type: r.standard_type as StandardUsageRow["standard_type"],
      invocation_count: Number(r.invocation_count),
      unique_developers: Number(r.unique_developers),
      unique_repos: Number(r.unique_repos),
      last_used_at: r.last_used_at,
      effectiveness_score:
        r.avg_outcome != null ? round1(Number(r.avg_outcome) * 100) : null,
      installed_repos: installedMap.get(r.standard_name) ?? 0,
      active_repos: Number(r.unique_repos),
    }));

    const trend: StandardUsageTrendPoint[] = trendRows.map((r) => ({
      date: r.date,
      invocations: Number(r.invocations),
    }));

    const response: StandardsUsageResponse = {
      period,
      summary,
      standards,
      trend,
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
    console.error("Dashboard standards-usage error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

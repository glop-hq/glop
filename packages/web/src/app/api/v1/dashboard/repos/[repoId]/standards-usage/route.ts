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
  RepoStandardsUsageResponse,
  RepoStandardUsageRow,
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
      eq(schema.standard_usage.repo_id, repoId),
      eq(schema.standard_usage.workspace_id, workspaceId),
      sql`${schema.standard_usage.created_at} >= ${periodStartStr}`
    );

    const [standardRows, developerRows] = await Promise.all([
      // Per-standard usage in this repo
      db
        .select({
          standard_name: schema.standard_usage.standard_name,
          standard_type: schema.standard_usage.standard_type,
          invocation_count: sql<number>`count(*)::int`,
          unique_developers: sql<number>`count(DISTINCT ${schema.standard_usage.developer_entity_id})::int`,
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
        .orderBy(sql`count(*) DESC`),

      // Per-developer breakdown
      db
        .select({
          developer_id: sql<string>`${schema.standard_usage.developer_entity_id}::text`,
          display_name: schema.developers.display_name,
          standards_used: sql<number>`count(DISTINCT ${schema.standard_usage.standard_name})::int`,
          total_invocations: sql<number>`count(*)::int`,
        })
        .from(schema.standard_usage)
        .leftJoin(
          schema.developers,
          eq(
            schema.standard_usage.developer_entity_id,
            schema.developers.id
          )
        )
        .where(baseWhere)
        .groupBy(
          schema.standard_usage.developer_entity_id,
          schema.developers.display_name
        )
        .orderBy(sql`count(*) DESC`)
        .limit(20),
    ]);

    const standards: RepoStandardUsageRow[] = standardRows.map((r) => ({
      standard_name: r.standard_name,
      standard_type: r.standard_type as RepoStandardUsageRow["standard_type"],
      invocation_count: Number(r.invocation_count),
      unique_developers: Number(r.unique_developers),
      last_used_at: r.last_used_at,
      effectiveness_score:
        r.avg_outcome != null ? round1(Number(r.avg_outcome) * 100) : null,
    }));

    const response: RepoStandardsUsageResponse = {
      period,
      repo_id: repoId,
      standards,
      developer_breakdown: developerRows.map((r) => ({
        developer_id: r.developer_id,
        display_name: r.display_name,
        standards_used: Number(r.standards_used),
        total_invocations: Number(r.total_invocations),
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
    console.error("Repo standards-usage error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

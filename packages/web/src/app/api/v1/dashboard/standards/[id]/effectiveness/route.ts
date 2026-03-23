import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and, notExists } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { analyticsPeriodSchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type {
  AnalyticsPeriod,
  StandardEffectivenessResponse,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: standardName } = await params;
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
      sp.get("period") ?? "30d"
    );
    const period: AnalyticsPeriod = periodParsed.success
      ? periodParsed.data
      : "30d";

    const db = getDb();
    const days = PERIOD_DAYS[period];
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    periodStart.setHours(0, 0, 0, 0);
    const periodStartStr = periodStart.toISOString();

    // Get the standard type
    const [typeRow] = await db
      .select({ standard_type: schema.standard_usage.standard_type })
      .from(schema.standard_usage)
      .where(
        and(
          eq(schema.standard_usage.workspace_id, workspaceId),
          eq(schema.standard_usage.standard_name, standardName)
        )
      )
      .limit(1);

    if (!typeRow) {
      return NextResponse.json(
        { error: "Standard not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Get repos where this standard was used (to scope the comparison)
    const usedRepoIds = db
      .select({ repo_id: schema.standard_usage.repo_id })
      .from(schema.standard_usage)
      .where(
        and(
          eq(schema.standard_usage.workspace_id, workspaceId),
          eq(schema.standard_usage.standard_name, standardName),
          sql`${schema.standard_usage.created_at} >= ${periodStartStr}`
        )
      );

    const [
      sessionsWithRows,
      sessionsWithoutRows,
      topRepoRows,
      trendRows,
    ] = await Promise.all([
      // Sessions that USED this standard
      db
        .select({
          count: sql<number>`count(DISTINCT ${schema.session_facets.run_id})::int`,
          avg_outcome: sql<number>`avg(
            CASE
              WHEN ${schema.session_facets.outcome} = 'success' THEN 1.0
              WHEN ${schema.session_facets.outcome} = 'partial' THEN 0.5
              ELSE 0.0
            END
          )`,
        })
        .from(schema.session_facets)
        .innerJoin(
          schema.standard_usage,
          and(
            eq(schema.session_facets.run_id, schema.standard_usage.run_id),
            eq(schema.standard_usage.standard_name, standardName)
          )
        )
        .where(
          and(
            eq(schema.session_facets.workspace_id, workspaceId),
            sql`${schema.session_facets.created_at} >= ${periodStartStr}`
          )
        ),

      // Sessions that did NOT use this standard (same repos, same period)
      db
        .select({
          count: sql<number>`count(*)::int`,
          avg_outcome: sql<number>`avg(
            CASE
              WHEN ${schema.session_facets.outcome} = 'success' THEN 1.0
              WHEN ${schema.session_facets.outcome} = 'partial' THEN 0.5
              ELSE 0.0
            END
          )`,
        })
        .from(schema.session_facets)
        .where(
          and(
            eq(schema.session_facets.workspace_id, workspaceId),
            sql`${schema.session_facets.created_at} >= ${periodStartStr}`,
            sql`${schema.session_facets.repo_id} IN (${usedRepoIds})`,
            notExists(
              db
                .select({ x: sql`1` })
                .from(schema.standard_usage)
                .where(
                  and(
                    eq(
                      schema.standard_usage.run_id,
                      schema.session_facets.run_id
                    ),
                    eq(schema.standard_usage.standard_name, standardName)
                  )
                )
            )
          )
        ),

      // Top repos by usage
      db
        .select({
          repo_id: sql<string>`${schema.standard_usage.repo_id}::text`,
          repo_key: schema.repos.repo_key,
          invocations: sql<number>`count(*)::int`,
        })
        .from(schema.standard_usage)
        .innerJoin(
          schema.repos,
          eq(schema.standard_usage.repo_id, schema.repos.id)
        )
        .where(
          and(
            eq(schema.standard_usage.workspace_id, workspaceId),
            eq(schema.standard_usage.standard_name, standardName),
            sql`${schema.standard_usage.created_at} >= ${periodStartStr}`
          )
        )
        .groupBy(schema.standard_usage.repo_id, schema.repos.repo_key)
        .orderBy(sql`count(*) DESC`)
        .limit(10),

      // Usage trend
      db
        .select({
          date: sql<string>`date_trunc('week', ${schema.standard_usage.created_at})::date::text`,
          invocations: sql<number>`count(*)::int`,
        })
        .from(schema.standard_usage)
        .where(
          and(
            eq(schema.standard_usage.workspace_id, workspaceId),
            eq(schema.standard_usage.standard_name, standardName),
            sql`${schema.standard_usage.created_at} >= ${periodStartStr}`
          )
        )
        .groupBy(
          sql`date_trunc('week', ${schema.standard_usage.created_at})`
        )
        .orderBy(
          sql`date_trunc('week', ${schema.standard_usage.created_at})`
        ),
    ]);

    const sessionsUsing = Number(sessionsWithRows[0]?.count ?? 0);
    const sessionsNotUsing = Number(sessionsWithoutRows[0]?.count ?? 0);
    const successRateWith =
      sessionsWithRows[0]?.avg_outcome != null
        ? round1(Number(sessionsWithRows[0].avg_outcome) * 100)
        : null;
    const successRateWithout =
      sessionsWithoutRows[0]?.avg_outcome != null
        ? round1(Number(sessionsWithoutRows[0].avg_outcome) * 100)
        : null;

    let effectivenessScore: number | null = null;
    if (successRateWith != null && successRateWithout != null && successRateWithout > 0) {
      effectivenessScore = round1(
        ((successRateWith - successRateWithout) / successRateWithout) * 100
      );
    }

    let confidence: "high" | "medium" | "low" | "insufficient";
    if (sessionsUsing < 10 || sessionsNotUsing < 10) {
      confidence = "insufficient";
    } else if (sessionsUsing >= 30 && sessionsNotUsing >= 30) {
      confidence = "high";
    } else if (sessionsUsing >= 20 && sessionsNotUsing >= 20) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    const response: StandardEffectivenessResponse = {
      standard_name: standardName,
      standard_type: typeRow.standard_type as StandardEffectivenessResponse["standard_type"],
      sessions_using: sessionsUsing,
      sessions_not_using: sessionsNotUsing,
      success_rate_with: successRateWith,
      success_rate_without: successRateWithout,
      effectiveness_score: effectivenessScore,
      confidence,
      top_repos: topRepoRows.map((r) => ({
        repo_id: r.repo_id,
        repo_key: r.repo_key,
        invocations: Number(r.invocations),
      })),
      usage_trend: trendRows.map(
        (r): StandardUsageTrendPoint => ({
          date: r.date,
          invocations: Number(r.invocations),
        })
      ),
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
    console.error("Standard effectiveness error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

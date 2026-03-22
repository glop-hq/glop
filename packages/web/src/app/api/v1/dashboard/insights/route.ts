import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dashboardQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { computeFrictionInsights } from "@/lib/friction-scorer";
import type {
  AnalyticsPeriod,
  InsightsResponse,
  FrictionInsight,
  SuccessPattern,
  HotspotEntry,
} from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

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

    const facetWhere = and(
      eq(schema.session_facets.workspace_id, workspace_id),
      sql`${schema.session_facets.created_at} >= ${periodStartStr}`
    );

    const [facetRows, successRows, hotspotRows, storedInsights] =
      await Promise.all([
        // Session facets for friction computation
        db
          .select({
            friction_counts: schema.session_facets.friction_counts,
            area: schema.session_facets.area,
            repo_key: sql<string>`(SELECT repo_key FROM repos WHERE id = ${schema.session_facets.repo_id})`,
            repo_id: sql<string>`${schema.session_facets.repo_id}::text`,
            created_at: schema.session_facets.created_at,
          })
          .from(schema.session_facets)
          .where(facetWhere),

        // Success patterns
        db
          .select({
            primary_success: schema.session_facets.primary_success,
            area: schema.session_facets.area,
            count: sql<number>`count(*)::int`,
          })
          .from(schema.session_facets)
          .where(
            and(
              facetWhere,
              sql`${schema.session_facets.primary_success} IS NOT NULL`
            )
          )
          .groupBy(
            schema.session_facets.primary_success,
            schema.session_facets.area
          )
          .orderBy(sql`count(*) DESC`)
          .limit(20),

        // Hotspot: friction by area
        db
          .select({
            area: schema.session_facets.area,
            session_count: sql<number>`count(*)::int`,
          })
          .from(schema.session_facets)
          .where(
            and(facetWhere, sql`${schema.session_facets.area} IS NOT NULL`)
          )
          .groupBy(schema.session_facets.area),

        // Stored friction insight statuses
        db
          .select({
            category: schema.friction_insights.category,
            status: schema.friction_insights.status,
            id: schema.friction_insights.id,
          })
          .from(schema.friction_insights)
          .where(eq(schema.friction_insights.workspace_id, workspace_id)),
      ]);

    // Compute friction from facets
    const computed = computeFrictionInsights(
      facetRows.map((r) => ({
        friction_counts: r.friction_counts as Record<string, number> | null,
        area: r.area,
        repo_key: r.repo_key,
        repo_id: r.repo_id,
        created_at: r.created_at,
      }))
    );

    // Merge with stored statuses
    const statusMap = new Map(
      storedInsights.map((s) => [s.category, { id: s.id, status: s.status }])
    );

    const friction_points: FrictionInsight[] = computed.map((c) => {
      const stored = statusMap.get(c.category);
      return {
        id: stored?.id ?? c.category, // use stored ID if exists, else category as temp ID
        category: c.category,
        description: c.description,
        impact_score: c.impact_score,
        frequency: c.frequency,
        severity: c.severity,
        affected_areas: c.affected_areas,
        suggested_action: null,
        status: stored?.status ?? "open",
        repo_key: c.repo_key,
        repo_id: c.repo_id,
        first_seen_at: c.first_seen_at,
        last_seen_at: c.last_seen_at,
      };
    });

    // Aggregate success patterns
    const successMap = new Map<
      string,
      { count: number; areas: Set<string> }
    >();
    for (const row of successRows) {
      if (!row.primary_success) continue;
      const entry = successMap.get(row.primary_success) ?? {
        count: 0,
        areas: new Set<string>(),
      };
      entry.count += Number(row.count);
      if (row.area) entry.areas.add(row.area);
      successMap.set(row.primary_success, entry);
    }

    const success_patterns: SuccessPattern[] = Array.from(
      successMap.entries()
    )
      .map(([pattern, entry]) => ({
        pattern,
        count: entry.count,
        areas: Array.from(entry.areas),
      }))
      .sort((a, b) => b.count - a.count);

    // Hotspot map — compute friction count per area
    const areaFrictionMap = new Map<string, number>();
    for (const facet of facetRows) {
      const counts = facet.friction_counts as Record<string, number> | null;
      if (!counts || !facet.area) continue;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      areaFrictionMap.set(
        facet.area,
        (areaFrictionMap.get(facet.area) ?? 0) + total
      );
    }

    const hotspot_map: HotspotEntry[] = hotspotRows
      .filter((r) => r.area != null)
      .map((r) => ({
        area: r.area!,
        friction_count: areaFrictionMap.get(r.area!) ?? 0,
        session_count: Number(r.session_count),
      }))
      .sort((a, b) => b.friction_count - a.friction_count);

    const response: InsightsResponse = {
      period,
      friction_points,
      success_patterns,
      hotspot_map,
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
    console.error("Insights error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

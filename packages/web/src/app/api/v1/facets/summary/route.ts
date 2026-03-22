import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, sql, count } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/facets/summary — Aggregated facet stats for a workspace.
 * Pure SQL aggregation, no LLM.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = request.nextUrl.searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Total count via COUNT(*) — no need to fetch all rows
    const [{ value: totalFacets }] = await db
      .select({ value: count() })
      .from(schema.session_facets)
      .where(eq(schema.session_facets.workspace_id, workspaceId));

    // Recent facets (last 30 days) — need rows for aggregation
    const recentFacets = await db
      .select({
        id: schema.session_facets.id,
        repo_id: schema.session_facets.repo_id,
        outcome: schema.session_facets.outcome,
        friction_counts: schema.session_facets.friction_counts,
        developer_id: schema.session_facets.developer_id,
      })
      .from(schema.session_facets)
      .where(
        and(
          eq(schema.session_facets.workspace_id, workspaceId),
          gte(schema.session_facets.created_at, thirtyDaysAgo)
        )
      );

    // Aggregate
    const recentCount = recentFacets.length;
    const uniqueDevs = new Set(recentFacets.map((f) => f.developer_id)).size;
    const uniqueRepos = new Set(recentFacets.map((f) => f.repo_id)).size;

    const outcomeDistribution: Record<string, number> = {};
    const frictionDistribution: Record<string, number> = {};
    const repoFrictionCounts: Record<string, number> = {};

    for (const facet of recentFacets) {
      outcomeDistribution[facet.outcome] =
        (outcomeDistribution[facet.outcome] || 0) + 1;

      const frictionCounts = facet.friction_counts as Record<string, number>;
      for (const [key, count] of Object.entries(frictionCounts)) {
        if (count > 0) {
          frictionDistribution[key] =
            (frictionDistribution[key] || 0) + count;
        }
      }

      const totalFriction = Object.values(frictionCounts).reduce(
        (sum, c) => sum + c,
        0
      );
      if (totalFriction > 0) {
        repoFrictionCounts[facet.repo_id] =
          (repoFrictionCounts[facet.repo_id] || 0) + totalFriction;
      }
    }

    // Get repo names for top friction repos
    const topFrictionRepoIds = Object.entries(repoFrictionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topFrictionRepos: Array<{
      repo_id: string;
      repo_key: string;
      friction_count: number;
    }> = [];

    if (topFrictionRepoIds.length > 0) {
      const repos = await db
        .select({ id: schema.repos.id, repo_key: schema.repos.repo_key })
        .from(schema.repos)
        .where(
          sql`${schema.repos.id} IN (${sql.join(
            topFrictionRepoIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      const repoMap = new Map(repos.map((r) => [r.id, r.repo_key]));
      topFrictionRepos = topFrictionRepoIds.map((id) => ({
        repo_id: id,
        repo_key: repoMap.get(id) || "unknown",
        friction_count: repoFrictionCounts[id],
      }));
    }

    return NextResponse.json({
      data: {
        total_facets: totalFacets,
        recent_facets: recentCount,
        recent_developers: uniqueDevs,
        recent_repos: uniqueRepos,
        outcome_distribution: outcomeDistribution,
        friction_distribution: frictionDistribution,
        top_friction_repos: topFrictionRepos,
      },
    });
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
    console.error("GET /api/v1/facets/summary error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

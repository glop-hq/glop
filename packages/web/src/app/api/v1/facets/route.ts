import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";
import { sessionFacetSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/facets — Submit a session facet from CLI.
 * Authenticated via API key (Bearer token).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const db = getDb();
    const auth = await validateApiKey(db, apiKey);

    if (!auth) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = sessionFacetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid facet data", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { workspace_id, repo_key, run_id, developer_id, ...facetData } = parsed.data;

    // Look up repo
    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.workspace_id, workspace_id),
          eq(schema.repos.repo_key, repo_key)
        )
      )
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Upsert facet (unique on run_id)
    const [facet] = await db
      .insert(schema.session_facets)
      .values({
        run_id,
        repo_id: repo.id,
        workspace_id,
        developer_id,
        goal_categories: facetData.goal_categories,
        outcome: facetData.outcome,
        satisfaction: facetData.satisfaction,
        session_type: facetData.session_type,
        friction_counts: facetData.friction_counts,
        friction_detail: facetData.friction_detail ?? null,
        primary_success: facetData.primary_success ?? null,
        files_touched: facetData.files_touched ?? [],
        area: facetData.area ?? null,
        brief_summary: facetData.brief_summary,
        duration_minutes: facetData.duration_minutes ?? null,
        iteration_count: facetData.iteration_count ?? null,
      })
      .onConflictDoUpdate({
        target: schema.session_facets.run_id,
        set: {
          goal_categories: facetData.goal_categories,
          outcome: facetData.outcome,
          satisfaction: facetData.satisfaction,
          session_type: facetData.session_type,
          friction_counts: facetData.friction_counts,
          friction_detail: facetData.friction_detail ?? null,
          primary_success: facetData.primary_success ?? null,
          files_touched: facetData.files_touched ?? [],
          area: facetData.area ?? null,
          brief_summary: facetData.brief_summary,
          duration_minutes: facetData.duration_minutes ?? null,
          iteration_count: facetData.iteration_count ?? null,
        },
      })
      .returning();

    return NextResponse.json({ data: { id: facet.id, run_id: facet.run_id } });
  } catch (error) {
    console.error("POST /api/v1/facets error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/facets — List session facets.
 * Supports both API key auth (CLI) and session auth (UI).
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const params = request.nextUrl.searchParams;
    const workspaceId = params.get("workspace_id");
    const repoKey = params.get("repo_key");
    const developerId = params.get("developer_id");
    const since = params.get("since");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Try API key auth first, then session auth
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.slice(7);
      const auth = await validateApiKey(db, apiKey);
      if (!auth) {
        return NextResponse.json(
          { error: "Invalid API key", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    } else {
      const session = await requireSession();
      requireWorkspaceMember(session, workspaceId);
    }

    const conditions = [eq(schema.session_facets.workspace_id, workspaceId)];

    if (since) {
      conditions.push(gte(schema.session_facets.created_at, since));
    }

    // If repo_key provided, look up repo_id first
    if (repoKey) {
      const [repo] = await db
        .select({ id: schema.repos.id })
        .from(schema.repos)
        .where(
          and(
            eq(schema.repos.workspace_id, workspaceId),
            eq(schema.repos.repo_key, repoKey)
          )
        )
        .limit(1);

      if (repo) {
        conditions.push(eq(schema.session_facets.repo_id, repo.id));
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    if (developerId) {
      conditions.push(eq(schema.session_facets.developer_id, developerId));
    }

    const facets = await db
      .select()
      .from(schema.session_facets)
      .where(and(...conditions))
      .orderBy(desc(schema.session_facets.created_at))
      .limit(200);

    return NextResponse.json({ data: facets });
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
    console.error("GET /api/v1/facets error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

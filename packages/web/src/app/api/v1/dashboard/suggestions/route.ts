import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/dashboard/suggestions — Workspace-level suggestion overview.
 * Query params: workspace_id (required)
 * Authenticated via session.
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

    // Count active suggestions by type
    const typeCounts = await db
      .select({
        suggestion_type: schema.standard_suggestions.suggestion_type,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.standard_suggestions)
      .where(
        and(
          eq(schema.standard_suggestions.workspace_id, workspaceId),
          eq(schema.standard_suggestions.status, "active")
        )
      )
      .groupBy(schema.standard_suggestions.suggestion_type);

    const by_type: Record<string, number> = {};
    let total_active = 0;
    for (const row of typeCounts) {
      by_type[row.suggestion_type] = row.count;
      total_active += row.count;
    }

    // Top 5 active suggestions with repo info
    const topSuggestions = await db
      .select({
        id: schema.standard_suggestions.id,
        repo_id: schema.standard_suggestions.repo_id,
        workspace_id: schema.standard_suggestions.workspace_id,
        suggestion_type: schema.standard_suggestions.suggestion_type,
        title: schema.standard_suggestions.title,
        rationale: schema.standard_suggestions.rationale,
        draft_filename: schema.standard_suggestions.draft_filename,
        pattern_type: schema.standard_suggestions.pattern_type,
        status: schema.standard_suggestions.status,
        created_at: schema.standard_suggestions.created_at,
        repo_key: schema.repos.repo_key,
        repo_display_name: schema.repos.display_name,
      })
      .from(schema.standard_suggestions)
      .innerJoin(
        schema.repos,
        eq(schema.standard_suggestions.repo_id, schema.repos.id)
      )
      .where(
        and(
          eq(schema.standard_suggestions.workspace_id, workspaceId),
          eq(schema.standard_suggestions.status, "active")
        )
      )
      .orderBy(desc(schema.standard_suggestions.created_at))
      .limit(5);

    return NextResponse.json({
      data: {
        total_active,
        by_type,
        top_suggestions: topSuggestions,
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
    console.error("GET /api/v1/dashboard/suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

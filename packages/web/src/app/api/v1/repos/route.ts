import { NextRequest, NextResponse } from "next/server";
import { eq, sql, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

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

    const repos = await db
      .select({
        id: schema.repos.id,
        workspace_id: schema.repos.workspace_id,
        repo_key: schema.repos.repo_key,
        display_name: schema.repos.display_name,
        description: schema.repos.description,
        default_branch: schema.repos.default_branch,
        language: schema.repos.language,
        first_seen_at: schema.repos.first_seen_at,
        last_active_at: schema.repos.last_active_at,
        created_at: schema.repos.created_at,
        updated_at: schema.repos.updated_at,
        run_count: sql<number>`count(${schema.runs.id})::int`,
      })
      .from(schema.repos)
      .leftJoin(schema.runs, eq(schema.runs.repo_id, schema.repos.id))
      .where(eq(schema.repos.workspace_id, workspaceId))
      .groupBy(schema.repos.id)
      .orderBy(desc(schema.repos.last_active_at));

    return NextResponse.json({ data: repos });
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
    console.error("GET /api/v1/repos error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

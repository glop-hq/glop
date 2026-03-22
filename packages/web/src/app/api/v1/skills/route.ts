import { NextRequest, NextResponse } from "next/server";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/skills — List claude items (skills & commands) across workspace repos.
 * Query params: workspace_id (required), kind (optional), search (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const params = request.nextUrl.searchParams;
    const workspaceId = params.get("workspace_id");
    const kind = params.get("kind");
    const search = params.get("search");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();

    const conditions = [eq(schema.claude_items.workspace_id, workspaceId)];

    if (kind === "skill" || kind === "command") {
      conditions.push(eq(schema.claude_items.kind, kind));
    }

    if (search) {
      conditions.push(
        or(
          ilike(schema.claude_items.name, `%${search}%`),
          ilike(schema.claude_items.content, `%${search}%`)
        )!
      );
    }

    const items = await db
      .select({
        id: schema.claude_items.id,
        repo_id: schema.claude_items.repo_id,
        workspace_id: schema.claude_items.workspace_id,
        kind: schema.claude_items.kind,
        name: schema.claude_items.name,
        file_path: schema.claude_items.file_path,
        content: schema.claude_items.content,
        created_at: schema.claude_items.created_at,
        updated_at: schema.claude_items.updated_at,
        repo_key: schema.repos.repo_key,
        repo_display_name: schema.repos.display_name,
      })
      .from(schema.claude_items)
      .innerJoin(schema.repos, eq(schema.claude_items.repo_id, schema.repos.id))
      .where(and(...conditions))
      .orderBy(desc(schema.claude_items.updated_at));

    return NextResponse.json({ data: items });
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
    console.error("GET /api/v1/skills error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

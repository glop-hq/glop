import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/skills/:id — Get a single claude item with full content.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const db = getDb();

    const [item] = await db
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
      .where(eq(schema.claude_items.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { error: "Item not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, item.workspace_id);

    return NextResponse.json({ data: item });
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
    console.error("GET /api/v1/skills/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

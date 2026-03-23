import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/repos/{id}/directives — List CLAUDE.md directives with effectiveness.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: repoId } = await params;
    const db = getDb();

    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, repoId))
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, repo.workspace_id);

    const directives = await db
      .select()
      .from(schema.claude_md_directives)
      .where(eq(schema.claude_md_directives.repo_id, repoId));

    // Compute effectiveness for each directive
    const data = directives.map((d) => ({
      id: d.id,
      directive: d.directive,
      source_file: d.source_file,
      source_line: d.source_line,
      category: d.category,
      sessions_relevant: d.sessions_relevant,
      sessions_followed: d.sessions_followed,
      effectiveness:
        d.sessions_relevant > 0
          ? Math.round((d.sessions_followed / d.sessions_relevant) * 100)
          : null,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    return NextResponse.json({ data });
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
    console.error("GET /api/v1/repos/[id]/directives error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

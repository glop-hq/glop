import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/repos/{id}/mcp-usage — MCP server usage stats for a repo.
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

    // Aggregate MCP usage per server
    const usage = await db
      .select({
        mcp_server: schema.run_mcp_usage.mcp_server,
        total_tool_calls: sql<number>`sum(${schema.run_mcp_usage.tool_calls})::int`,
        session_count: sql<number>`count(distinct ${schema.run_mcp_usage.run_id})::int`,
      })
      .from(schema.run_mcp_usage)
      .where(eq(schema.run_mcp_usage.repo_id, repoId))
      .groupBy(schema.run_mcp_usage.mcp_server);

    // Get total session count for this repo (for percentage calculation)
    const [{ total_sessions }] = await db
      .select({ total_sessions: sql<number>`count(*)::int` })
      .from(schema.runs)
      .where(eq(schema.runs.repo_id, repoId));

    const data = usage.map((u) => ({
      mcp_server: u.mcp_server,
      total_tool_calls: u.total_tool_calls,
      session_count: u.session_count,
      usage_percentage:
        total_sessions > 0
          ? Math.round((u.session_count / total_sessions) * 100)
          : 0,
    }));

    return NextResponse.json({
      data,
      total_sessions,
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
    console.error("GET /api/v1/repos/[id]/mcp-usage error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

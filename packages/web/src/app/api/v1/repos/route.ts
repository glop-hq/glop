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

    // Use correlated subqueries for latest scan data — avoids duplicate rows
    // from joining a multi-row scan table. The (repo_id, created_at) index
    // keeps these efficient.
    const latestScanId = sql`(
      select id from repo_scans
      where repo_id = ${schema.repos.id}
      order by created_at desc limit 1
    )`;

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
        last_scanned_at: schema.repos.last_scanned_at,
        created_at: schema.repos.created_at,
        updated_at: schema.repos.updated_at,
        run_count: sql<number>`count(distinct ${schema.runs.id})::int`,
        latest_scan_score: sql<number | null>`(
          select score from repo_scans
          where repo_id = ${schema.repos.id}
          order by created_at desc limit 1
        )`,
        latest_scan_status: sql<string | null>`(
          select status::text from repo_scans
          where repo_id = ${schema.repos.id}
          order by created_at desc limit 1
        )`,
        latest_scan_at: sql<string | null>`(
          select completed_at from repo_scans
          where repo_id = ${schema.repos.id}
          order by created_at desc limit 1
        )`,
        critical_count: sql<number>`coalesce((
          select count(*) from repo_scan_checks
          where scan_id = ${latestScanId}
          and severity = 'critical' and status != 'pass'
        ), 0)::int`,
        warning_count: sql<number>`coalesce((
          select count(*) from repo_scan_checks
          where scan_id = ${latestScanId}
          and severity = 'warning' and status != 'pass'
        ), 0)::int`,
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

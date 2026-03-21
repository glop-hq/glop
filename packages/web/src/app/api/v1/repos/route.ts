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

    // Subquery for latest scan per repo
    const latestScan = db
      .select({
        repo_id: schema.repo_scans.repo_id,
        score: schema.repo_scans.score,
        status: schema.repo_scans.status,
        completed_at: schema.repo_scans.completed_at,
        scan_id: schema.repo_scans.id,
      })
      .from(schema.repo_scans)
      .where(eq(schema.repo_scans.workspace_id, workspaceId))
      .orderBy(desc(schema.repo_scans.created_at))
      .as("latest_scan");

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
        latest_scan_score: latestScan.score,
        latest_scan_status: latestScan.status,
        latest_scan_at: latestScan.completed_at,
      })
      .from(schema.repos)
      .leftJoin(schema.runs, eq(schema.runs.repo_id, schema.repos.id))
      .leftJoin(
        latestScan,
        sql`${latestScan.repo_id} = ${schema.repos.id} AND ${latestScan.completed_at} = ${schema.repos.last_scanned_at}`
      )
      .where(eq(schema.repos.workspace_id, workspaceId))
      .groupBy(
        schema.repos.id,
        latestScan.score,
        latestScan.status,
        latestScan.completed_at
      )
      .orderBy(desc(schema.repos.last_active_at));

    // Fetch critical/warning counts for repos that have scans
    const repoIds = repos.filter((r) => r.latest_scan_at).map((r) => r.id);
    let findingCounts: Record<string, { critical_count: number; warning_count: number }> = {};

    if (repoIds.length > 0) {
      const counts = await db
        .select({
          repo_id: schema.repo_scans.repo_id,
          critical_count: sql<number>`count(*) filter (where ${schema.repo_scan_checks.severity} = 'critical' and ${schema.repo_scan_checks.status} != 'pass')::int`,
          warning_count: sql<number>`count(*) filter (where ${schema.repo_scan_checks.severity} = 'warning' and ${schema.repo_scan_checks.status} != 'pass')::int`,
        })
        .from(schema.repo_scans)
        .innerJoin(
          schema.repo_scan_checks,
          eq(schema.repo_scan_checks.scan_id, schema.repo_scans.id)
        )
        .where(
          sql`${schema.repo_scans.completed_at} = (
            select max(rs2.completed_at) from repo_scans rs2 where rs2.repo_id = ${schema.repo_scans.repo_id}
          )`
        )
        .groupBy(schema.repo_scans.repo_id);

      for (const c of counts) {
        findingCounts[c.repo_id] = {
          critical_count: c.critical_count,
          warning_count: c.warning_count,
        };
      }
    }

    const data = repos.map((r) => ({
      ...r,
      critical_count: findingCounts[r.id]?.critical_count ?? 0,
      warning_count: findingCounts[r.id]?.warning_count ?? 0,
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
    console.error("GET /api/v1/repos error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

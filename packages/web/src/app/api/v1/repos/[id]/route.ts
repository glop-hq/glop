import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  isWorkspaceAdmin,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { repoUpdateSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

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

    // Get latest scan with checks
    const [latestScan] = await db
      .select()
      .from(schema.repo_scans)
      .where(eq(schema.repo_scans.repo_id, repoId))
      .orderBy(desc(schema.repo_scans.created_at))
      .limit(1);

    let checks: typeof schema.repo_scan_checks.$inferSelect[] = [];
    if (latestScan) {
      checks = await db
        .select()
        .from(schema.repo_scan_checks)
        .where(eq(schema.repo_scan_checks.scan_id, latestScan.id));
    }

    // Get recent runs for this repo
    const recentRuns = await db
      .select({
        id: schema.runs.id,
        developer_id: schema.runs.developer_id,
        git_user_name: schema.runs.git_user_name,
        status: schema.runs.status,
        title: schema.runs.title,
        started_at: schema.runs.started_at,
        completed_at: schema.runs.completed_at,
        event_count: schema.runs.event_count,
        file_count: schema.runs.file_count,
      })
      .from(schema.runs)
      .where(eq(schema.runs.repo_id, repoId))
      .orderBy(desc(schema.runs.started_at))
      .limit(10);

    // Get run count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.runs)
      .where(eq(schema.runs.repo_id, repoId));

    // Get scan history (last 10)
    const scanHistory = await db
      .select({
        id: schema.repo_scans.id,
        score: schema.repo_scans.score,
        status: schema.repo_scans.status,
        triggered_by: schema.repo_scans.triggered_by,
        completed_at: schema.repo_scans.completed_at,
        created_at: schema.repo_scans.created_at,
      })
      .from(schema.repo_scans)
      .where(eq(schema.repo_scans.repo_id, repoId))
      .orderBy(desc(schema.repo_scans.created_at))
      .limit(10);

    return NextResponse.json({
      data: {
        repo,
        run_count: count,
        latest_scan: latestScan
          ? { ...latestScan, checks }
          : null,
        scan_history: scanHistory,
        recent_runs: recentRuns,
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
    console.error("GET /api/v1/repos/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
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

    if (!isWorkspaceAdmin(session, repo.workspace_id)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = repoUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(schema.repos)
      .set({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.repos.id, repoId))
      .returning();

    return NextResponse.json({ data: updated });
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
    console.error("PUT /api/v1/repos/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

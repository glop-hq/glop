import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCAN_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GET /api/v1/repos/scan-status — Check if a repo needs scanning.
 * Used by CLI on SessionStart to decide whether to spawn background scan.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization", code: "UNAUTHORIZED" },
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

    const workspaceId = request.nextUrl.searchParams.get("workspace_id");
    const repoKey = request.nextUrl.searchParams.get("repo_key");

    if (!workspaceId || !repoKey) {
      return NextResponse.json(
        { error: "workspace_id and repo_key are required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const [repo] = await db
      .select({ last_scanned_at: schema.repos.last_scanned_at })
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.workspace_id, workspaceId),
          eq(schema.repos.repo_key, repoKey)
        )
      )
      .limit(1);

    if (!repo) {
      // Repo not yet in DB — needs scan when it's created
      return NextResponse.json({
        needs_scan: true,
        last_scanned_at: null,
      });
    }

    const needsScan =
      !repo.last_scanned_at ||
      Date.now() - new Date(repo.last_scanned_at).getTime() > SCAN_STALE_MS;

    return NextResponse.json({
      needs_scan: needsScan,
      last_scanned_at: repo.last_scanned_at,
    });
  } catch (error) {
    console.error("GET /api/v1/repos/scan-status error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

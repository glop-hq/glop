import { NextRequest, NextResponse } from "next/server";
import { desc, inArray, and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { sweepStaleRuns } from "@/lib/stale-checker";
import { requireSession, AuthError } from "@/lib/session";
import type { Run, ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const db = getDb();

    // Persist stale/auto-close status changes so the DB stays accurate
    await sweepStaleRuns(db);

    const allWorkspaceIds = session.workspaces.map((w) => w.id);
    if (allWorkspaceIds.length === 0) {
      return NextResponse.json({ runs: [], updated_at: new Date().toISOString() });
    }

    // Scope to a single workspace if requested, otherwise all
    const requestedId = request.nextUrl.searchParams.get("workspace_id");
    const workspaceIds =
      requestedId && allWorkspaceIds.includes(requestedId)
        ? [requestedId]
        : allWorkspaceIds;

    const fiveMinutesAgoMs = Date.now() - 5 * 60 * 1000;

    // Get active runs filtered by workspace membership
    const runs = await db
      .select()
      .from(schema.runs)
      .where(
        and(
          inArray(schema.runs.status, ["active", "stale", "blocked"]),
          inArray(schema.runs.workspace_id, workspaceIds)
        )
      )
      .orderBy(desc(schema.runs.last_event_at));

    // Also get recently completed runs filtered by workspace
    const recentlyCompleted = await db
      .select()
      .from(schema.runs)
      .where(
        and(
          inArray(schema.runs.status, ["completed", "failed"]),
          inArray(schema.runs.workspace_id, workspaceIds)
        )
      )
      .orderBy(desc(schema.runs.last_event_at))
      .limit(5);

    const recentlyCompletedFiltered = recentlyCompleted.filter(
      (r) => {
        const lastActive = r.last_event_at || r.completed_at;
        return lastActive && new Date(lastActive).getTime() >= fiveMinutesAgoMs;
      }
    );

    const updatedRuns = [...runs, ...recentlyCompletedFiltered] as Run[];
    updatedRuns.sort((a, b) => {
      const aTime = new Date(a.last_event_at || a.started_at).getTime();
      const bTime = new Date(b.last_event_at || b.started_at).getTime();
      return bTime - aTime;
    });

    // Get artifacts for all runs
    const runIds = updatedRuns.map((r) => r.id);
    let artifacts: ArtifactInfo[] = [];

    if (runIds.length > 0) {
      const rawArtifacts = await db
        .select()
        .from(schema.artifacts)
        .where(inArray(schema.artifacts.run_id, runIds));

      artifacts = rawArtifacts as ArtifactInfo[];
    }

    // Attach artifacts to runs
    const runsWithArtifacts = updatedRuns.map((run) => ({
      ...run,
      artifacts: artifacts.filter((a) => a.run_id === run.id),
    }));

    return NextResponse.json({
      runs: runsWithArtifacts,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Live board error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

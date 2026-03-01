import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { sweepStaleRuns } from "@/lib/stale-checker";
import { requireSession, AuthError } from "@/lib/session";
import type { Run, ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const db = getDb();

    // Persist stale/auto-close status changes so the DB stays accurate
    await sweepStaleRuns(db);

    const fiveMinutesAgoMs = Date.now() - 5 * 60 * 1000;

    // Get active runs (after sweep, only truly active ones remain)
    const runs = await db
      .select()
      .from(schema.runs)
      .where(
        inArray(schema.runs.status, ["active", "stale", "blocked"])
      )
      .orderBy(desc(schema.runs.last_event_at));

    // Also get recently completed runs (active within last 5 minutes)
    const recentlyCompleted = await db
      .select()
      .from(schema.runs)
      .where(
        inArray(schema.runs.status, ["completed", "failed"])
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

    void session; // workspace filtering comes in a later phase

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

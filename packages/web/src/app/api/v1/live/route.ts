import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { applyTimeBasedStatus } from "@/lib/stale-checker";
import type { Run, ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    // Get active + recently completed runs (completed in last 5 minutes)
    const fiveMinutesAgoMs = Date.now() - 5 * 60 * 1000;

    const runs = await db
      .select()
      .from(schema.runs)
      .where(
        inArray(schema.runs.status, ["active", "stale", "blocked"])
      )
      .orderBy(desc(schema.runs.last_event_at));

    // Also get recently completed runs
    const recentlyCompleted = await db
      .select()
      .from(schema.runs)
      .where(
        inArray(schema.runs.status, ["completed", "failed"])
      )
      .orderBy(desc(schema.runs.completed_at))
      .limit(5);

    const recentlyCompletedFiltered = recentlyCompleted.filter(
      (r) => r.completed_at && new Date(r.completed_at).getTime() >= fiveMinutesAgoMs
    );

    const allRuns = [...runs, ...recentlyCompletedFiltered] as Run[];
    // Sort all runs by most recently updated first
    allRuns.sort((a, b) => {
      const aTime = new Date(a.last_event_at || a.started_at).getTime();
      const bTime = new Date(b.last_event_at || b.started_at).getTime();
      return bTime - aTime;
    });
    const updatedRuns = applyTimeBasedStatus(allRuns);

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
    console.error("Live board error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

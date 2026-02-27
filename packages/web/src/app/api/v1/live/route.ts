import { NextResponse } from "next/server";
import { desc, inArray, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { applyTimeBasedStatus } from "@/lib/stale-checker";
import type { Run, ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    // Get active + recently completed runs (completed in last 5 minutes)
    const fiveMinutesAgo = new Date(
      Date.now() - 5 * 60 * 1000
    ).toISOString();

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
      (r) => r.completed_at && r.completed_at >= fiveMinutesAgo
    );

    const allRuns = [...runs, ...recentlyCompletedFiltered] as Run[];
    // Sort all runs by most recently updated first
    allRuns.sort((a, b) => {
      const aTime = a.last_event_at || a.started_at || "";
      const bTime = b.last_event_at || b.started_at || "";
      return bTime.localeCompare(aTime);
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

      artifacts = rawArtifacts.map((a) => ({
        ...a,
        metadata: JSON.parse(a.metadata || "{}"),
      })) as ArtifactInfo[];
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

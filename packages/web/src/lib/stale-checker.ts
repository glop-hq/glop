import { eq, inArray } from "drizzle-orm";
import { schema, type DbClient } from "./db";
import { deriveTimeBasedStatus, type Run } from "@glop/shared";

export async function sweepStaleRuns(db: DbClient): Promise<number> {
  const now = new Date();
  let updated = 0;

  const openRuns = await db
    .select()
    .from(schema.runs)
    .where(inArray(schema.runs.status, ["active", "stale", "blocked"]));

  for (const run of openRuns) {
    const update = deriveTimeBasedStatus(run as Run, now);
    if (update) {
      const setData: Record<string, unknown> = {
        status: update.status,
        updated_at: now.toISOString(),
      };
      if (update.completed_at) {
        setData.completed_at = update.completed_at;
        setData.phase = "done";
      }

      await db
        .update(schema.runs)
        .set(setData)
        .where(eq(schema.runs.id, run.id));
      updated++;
    }
  }

  return updated;
}

// Apply stale check to runs on read (lazy check for dashboard accuracy)
export function applyTimeBasedStatus(runs: Run[]): Run[] {
  const now = new Date();
  return runs.map((run) => {
    const update = deriveTimeBasedStatus(run, now);
    if (update) {
      return {
        ...run,
        status: update.status,
        completed_at: update.completed_at || run.completed_at,
        phase: update.completed_at ? "done" as const : run.phase,
      };
    }
    return run;
  });
}

/**
 * Correlates context health (compaction data) with session outcomes
 * to generate per-repo session length recommendations.
 */

import { eq } from "drizzle-orm";
import { schema, type DbClient } from "./db";

interface BucketStats {
  label: string;
  session_count: number;
  fully_achieved: number;
  mostly_achieved: number;
  partially_achieved: number;
  not_achieved: number;
  avg_friction: number;
}

export interface ContextRecommendation {
  recommended_max_duration_min: number | null;
  confidence: "low" | "medium" | "high";
  sample_size: number;
  reasoning: string;
}

const MIN_SESSIONS = 20;
const STALE_DAYS = 7;

/**
 * Check if a repo's recommendation is stale (>7 days old).
 */
export async function isRecommendationStale(
  db: DbClient,
  repoId: string
): Promise<boolean> {
  const [row] = await db
    .select({ updated_at: schema.repo_context_recommendations.updated_at })
    .from(schema.repo_context_recommendations)
    .where(eq(schema.repo_context_recommendations.repo_id, repoId))
    .limit(1);

  if (!row) return true;
  const age =
    (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  return age > STALE_DAYS;
}

/**
 * Compute context health correlation for a repo and generate a recommendation.
 * Joins run_context_health with session_facets on run_id,
 * buckets sessions by compaction count, and compares outcomes.
 */
export async function computeRepoRecommendation(
  db: DbClient,
  repoId: string,
  workspaceId: string
): Promise<ContextRecommendation | null> {
  // Join context health with session facets
  const rows = await db
    .select({
      compaction_count: schema.run_context_health.compaction_count,
      first_compaction_at_min:
        schema.run_context_health.first_compaction_at_min,
      outcome: schema.session_facets.outcome,
      friction_counts: schema.session_facets.friction_counts,
    })
    .from(schema.run_context_health)
    .innerJoin(
      schema.session_facets,
      eq(schema.session_facets.run_id, schema.run_context_health.run_id)
    )
    .where(eq(schema.run_context_health.repo_id, repoId));

  if (rows.length < MIN_SESSIONS) return null;

  // Bucket by compaction count: 0, 1, 2, 3+
  const buckets: Record<string, BucketStats> = {
    "0": makeBucket("0 compactions"),
    "1": makeBucket("1 compaction"),
    "2": makeBucket("2 compactions"),
    "3+": makeBucket("3+ compactions"),
  };

  for (const row of rows) {
    const key =
      row.compaction_count === 0
        ? "0"
        : row.compaction_count === 1
          ? "1"
          : row.compaction_count === 2
            ? "2"
            : "3+";
    const b = buckets[key];
    b.session_count++;

    const outcome = row.outcome ?? "unclear";
    if (outcome === "fully_achieved") b.fully_achieved++;
    else if (outcome === "mostly_achieved") b.mostly_achieved++;
    else if (outcome === "partially_achieved") b.partially_achieved++;
    else if (outcome === "not_achieved") b.not_achieved++;

    const frictionTotal = row.friction_counts
      ? Object.values(row.friction_counts).reduce(
          (sum, v) => sum + (v ?? 0),
          0
        )
      : 0;
    b.avg_friction += frictionTotal;
  }

  // Finalize averages
  for (const b of Object.values(buckets)) {
    if (b.session_count > 0) {
      b.avg_friction = Math.round((b.avg_friction / b.session_count) * 10) / 10;
    }
  }

  const noCompaction = buckets["0"];
  const withCompaction = {
    session_count:
      buckets["1"].session_count +
      buckets["2"].session_count +
      buckets["3+"].session_count,
    success_rate: 0,
  };

  if (noCompaction.session_count === 0 || withCompaction.session_count === 0) {
    // Not enough data in both groups to compare
    return null;
  }

  const noCompactionSuccessRate =
    (noCompaction.fully_achieved + noCompaction.mostly_achieved) /
    noCompaction.session_count;
  const withCompactionSuccess =
    buckets["1"].fully_achieved +
    buckets["1"].mostly_achieved +
    buckets["2"].fully_achieved +
    buckets["2"].mostly_achieved +
    buckets["3+"].fully_achieved +
    buckets["3+"].mostly_achieved;
  const withCompactionSuccessRate =
    withCompactionSuccess / withCompaction.session_count;

  // Compute average time to first compaction
  const compactionTimes = rows
    .filter((r) => r.first_compaction_at_min != null)
    .map((r) => r.first_compaction_at_min!);
  const avgFirstCompaction =
    compactionTimes.length > 0
      ? Math.round(
          compactionTimes.reduce((s, v) => s + v, 0) / compactionTimes.length
        )
      : null;

  // Only recommend if there's a meaningful difference
  const successDelta = noCompactionSuccessRate - withCompactionSuccessRate;
  if (successDelta < 0.1) {
    // Less than 10% difference — not enough signal
    return null;
  }

  const confidence: "low" | "medium" | "high" =
    rows.length >= 100 ? "high" : rows.length >= 50 ? "medium" : "low";

  const noCompPct = Math.round(noCompactionSuccessRate * 100);
  const withCompPct = Math.round(withCompactionSuccessRate * 100);

  const reasoning = avgFirstCompaction
    ? `Sessions without compaction have ${noCompPct}% success vs ${withCompPct}% with compaction. Average time to first compaction: ${avgFirstCompaction} min.`
    : `Sessions without compaction have ${noCompPct}% success vs ${withCompPct}% with compaction.`;

  return {
    recommended_max_duration_min: avgFirstCompaction,
    confidence,
    sample_size: rows.length,
    reasoning,
  };
}

/**
 * Compute and store recommendation for a repo.
 */
export async function refreshRepoRecommendation(
  db: DbClient,
  repoId: string,
  workspaceId: string
): Promise<void> {
  const rec = await computeRepoRecommendation(db, repoId, workspaceId);
  const now = new Date().toISOString();

  if (rec) {
    await db
      .insert(schema.repo_context_recommendations)
      .values({
        repo_id: repoId,
        workspace_id: workspaceId,
        recommended_max_duration_min: rec.recommended_max_duration_min,
        confidence: rec.confidence,
        sample_size: rec.sample_size,
        reasoning: rec.reasoning,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: schema.repo_context_recommendations.repo_id,
        set: {
          recommended_max_duration_min: rec.recommended_max_duration_min,
          confidence: rec.confidence,
          sample_size: rec.sample_size,
          reasoning: rec.reasoning,
          updated_at: now,
        },
      });
  } else {
    // Remove stale recommendation if data no longer supports it
    await db
      .delete(schema.repo_context_recommendations)
      .where(eq(schema.repo_context_recommendations.repo_id, repoId));
  }
}

function makeBucket(label: string): BucketStats {
  return {
    label,
    session_count: 0,
    fully_achieved: 0,
    mostly_achieved: 0,
    partially_achieved: 0,
    not_achieved: 0,
    avg_friction: 0,
  };
}

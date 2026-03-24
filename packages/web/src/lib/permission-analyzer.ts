import { eq, and, sql, gte } from "drizzle-orm";
import { schema, type DbClient } from "./db";

// Minimum total permission events for a repo before generating recommendations
const MIN_EVENTS_FOR_RECOMMENDATIONS = 3;

// Patterns that must never be recommended — too broad / dangerous
const BLOCKED_PATTERNS = new Set(["Bash(*)"]);

function assignTier(
  frequency: number,
  consensus: number
): "auto_allow" | "consider" | "keep_manual" {
  // Auto-allow: prompted ≥ 10 times, ≥ 80% of developers hit it
  if (frequency >= 10 && consensus >= 0.8) return "auto_allow";
  // Consider: prompted ≥ 5 times
  if (frequency >= 5) return "consider";
  // Keep manual: everything else
  return "keep_manual";
}

/**
 * Analyze permission events for a repo and generate recommendations.
 * Deletes old recommendations and inserts fresh ones.
 */
export async function analyzeRepoPermissions(
  db: DbClient,
  repoId: string,
  workspaceId: string
): Promise<number> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Aggregate permission prompt events by pattern in the last 30 days
  const rows = await db
    .select({
      pattern: schema.permission_events.pattern,
      total: sql<number>`count(*)::int`,
      unique_developers: sql<number>`count(DISTINCT ${schema.permission_events.developer_id})::int`,
    })
    .from(schema.permission_events)
    .where(
      and(
        eq(schema.permission_events.repo_id, repoId),
        gte(schema.permission_events.created_at, thirtyDaysAgo)
      )
    )
    .groupBy(schema.permission_events.pattern);

  const totalEvents = rows.reduce((sum, r) => sum + r.total, 0);

  if (rows.length === 0 || totalEvents < MIN_EVENTS_FOR_RECOMMENDATIONS) {
    // Not enough data — clear any stale recommendations
    await db
      .delete(schema.permission_recommendations)
      .where(eq(schema.permission_recommendations.repo_id, repoId));
    return 0;
  }

  // Get total unique developers for this repo in the period
  const [devCount] = await db
    .select({
      count: sql<number>`count(DISTINCT ${schema.permission_events.developer_id})::int`,
    })
    .from(schema.permission_events)
    .where(
      and(
        eq(schema.permission_events.repo_id, repoId),
        gte(schema.permission_events.created_at, thirtyDaysAgo)
      )
    );
  const totalDevelopers = devCount?.count ?? 1;

  const now = new Date().toISOString();
  const recommendations = rows.map((row) => {
    const consensus =
      totalDevelopers > 0 ? row.unique_developers / totalDevelopers : 0;
    // Force dangerous patterns to keep_manual regardless of stats
    const tier = BLOCKED_PATTERNS.has(row.pattern)
      ? "keep_manual" as const
      : assignTier(row.total, consensus);

    // Estimate time saved: prompts per week × 3 seconds per prompt
    // 30 days ≈ 4.3 weeks
    const weeklyFrequency = Math.round(row.total / 4.3);
    const estTimeSavedSec = tier === "auto_allow" ? weeklyFrequency * 3 : 0;

    return {
      repo_id: repoId,
      workspace_id: workspaceId,
      pattern: row.pattern,
      tier,
      approval_rate: 1.0, // all recorded events are prompts that were approved
      frequency: row.total,
      developer_consensus: Math.round(consensus * 1000) / 1000,
      est_time_saved_sec: estTimeSavedSec,
      created_at: now,
      updated_at: now,
    };
  });

  // Replace old recommendations in a transaction to avoid empty-state window
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.permission_recommendations)
      .where(eq(schema.permission_recommendations.repo_id, repoId));

    if (recommendations.length > 0) {
      await tx
        .insert(schema.permission_recommendations)
        .values(recommendations);
    }
  });

  return recommendations.length;
}

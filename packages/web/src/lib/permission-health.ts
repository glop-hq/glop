import { eq, and, sql, gte } from "drizzle-orm";
import { schema, type DbClient } from "./db";

/**
 * Compute a permission health score for a repo.
 *
 * Scoring (adapted from PRD 12):
 *  25   — Has auto_allow recommendations but no settings file
 *  50   — Has settings but unaddressed auto_allow recs, or no settings + no auto_allow
 *  75   — Has settings, no auto_allow recommendations (all consider/keep_manual)
 * 100   — Fully optimized or no recommendations needed
 * null  — Insufficient data (< 3 permission events in last 30 days)
 */
export async function computePermissionHealth(
  db: DbClient,
  repoId: string
): Promise<number | null> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Count permission events in the last 30 days
  const [eventCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.permission_events)
    .where(
      and(
        eq(schema.permission_events.repo_id, repoId),
        gte(schema.permission_events.created_at, thirtyDaysAgo)
      )
    );

  if ((eventCount?.count ?? 0) < 3) return null;

  // Get recommendation counts by tier
  const recs = await db
    .select({
      tier: schema.permission_recommendations.tier,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.permission_recommendations)
    .where(eq(schema.permission_recommendations.repo_id, repoId))
    .groupBy(schema.permission_recommendations.tier);

  const totalRecs = recs.reduce((sum, r) => sum + r.count, 0);
  const autoAllowCount =
    recs.find((r) => r.tier === "auto_allow")?.count ?? 0;

  // No recommendations needed — no friction detected
  if (totalRecs === 0) return 100;

  // Check if the repo has a .claude/settings.json via the latest scan check
  const settingsCheck = await db
    .select({ score: schema.repo_scan_checks.score })
    .from(schema.repo_scan_checks)
    .innerJoin(
      schema.repo_scans,
      eq(schema.repo_scans.id, schema.repo_scan_checks.scan_id)
    )
    .where(
      and(
        eq(schema.repo_scans.repo_id, repoId),
        eq(schema.repo_scan_checks.check_id, "claude_settings"),
        sql`${schema.repo_scans.status} = 'completed'`
      )
    )
    .orderBy(sql`${schema.repo_scans.created_at} DESC`)
    .limit(1);

  const hasSettings = (settingsCheck[0]?.score ?? 0) > 0;

  if (autoAllowCount === 0) {
    // All patterns are consider/keep_manual — moderate to good health
    return hasSettings ? 75 : 50;
  }

  // Auto-allow recommendations exist (friction not addressed)
  return hasSettings ? 50 : 25;
}

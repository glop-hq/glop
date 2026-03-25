import { eq, and, sql } from "drizzle-orm";
import { schema, type DbClient } from "./db";
import { analyzeRepoPermissions } from "./permission-analyzer";
import { computePermissionHealth } from "./permission-health";

/**
 * Stateless auto-trigger for permission analysis.
 *
 * Called after each permission event is recorded. Checks whether the last
 * analysis for this repo is older than STALENESS_THRESHOLD_MS. If so, runs
 * analysis inline and refreshes the permission_health_score on the latest scan.
 *
 * Stateless by design — no in-memory timers — so it works in serverless (Vercel).
 * The staleness check acts as a natural throttle: at most one analysis per
 * STALENESS_THRESHOLD_MS per repo regardless of event volume.
 *
 * Best-effort: failures are logged but never surface to callers.
 */

const STALENESS_THRESHOLD_MS = 5 * 60_000; // 5 minutes

export async function maybeAnalyzePermissions(
  db: DbClient,
  repoId: string,
  workspaceId: string
): Promise<void> {
  try {
    // Check when the last analysis ran for this repo
    const [latest] = await db
      .select({ updated_at: schema.permission_recommendations.updated_at })
      .from(schema.permission_recommendations)
      .where(eq(schema.permission_recommendations.repo_id, repoId))
      .orderBy(sql`${schema.permission_recommendations.updated_at} DESC`)
      .limit(1);

    if (latest) {
      const age = Date.now() - new Date(latest.updated_at).getTime();
      if (age < STALENESS_THRESHOLD_MS) return;
    }

    await analyzeRepoPermissions(db, repoId, workspaceId);

    // Refresh permission health on the latest scan
    const healthScore = await computePermissionHealth(db, repoId);
    if (healthScore !== null) {
      const [latestScan] = await db
        .select({ id: schema.repo_scans.id })
        .from(schema.repo_scans)
        .where(
          and(
            eq(schema.repo_scans.repo_id, repoId),
            sql`${schema.repo_scans.status} = 'completed'`
          )
        )
        .orderBy(sql`${schema.repo_scans.created_at} DESC`)
        .limit(1);

      if (latestScan) {
        await db
          .update(schema.repo_scans)
          .set({ permission_health_score: healthScore })
          .where(eq(schema.repo_scans.id, latestScan.id));
      }
    }
  } catch (err) {
    console.error(
      `[permission-scheduler] Auto-analysis failed for repo ${repoId}:`,
      err
    );
  }
}

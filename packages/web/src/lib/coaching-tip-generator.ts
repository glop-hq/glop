/**
 * Coaching Tip Generator (PRD 11)
 *
 * Evaluates multiple data sources to generate personalized coaching tips
 * for developers. Tips are scored by impact, deduped, and stored.
 */

import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { getDb, schema, type DbClient } from "./db";
import { computeFrictionInsights } from "./friction-scorer";

interface CandidateTip {
  source_type: "repo_insight" | "readiness" | "facet_pattern" | "context_health" | "claude_md" | "standard" | "curated";
  source_id: string | null;
  title: string;
  body: string;
  action_type: "copy_to_clipboard" | "open_link" | "dismiss";
  action_payload: string | null;
  priority: "high" | "medium" | "low";
  repo_id: string | null;
  score: number;
}

const TIPS_PER_DEVELOPER = 3;
const TIP_EXPIRY_DAYS = 30;
const LOOKBACK_DAYS = 30;

/**
 * Generate coaching tips for all active developers in a workspace.
 */
export async function generateCoachingTips(workspaceId: string): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  // Get active developers (those with sessions in last 30 days)
  const activeDevelopers = await db
    .select({
      id: schema.developers.id,
    })
    .from(schema.developers)
    .where(
      and(
        eq(schema.developers.workspace_id, workspaceId),
        gte(schema.developers.last_active_at, cutoff)
      )
    );

  let totalTipsCreated = 0;

  for (const developer of activeDevelopers) {
    const count = await generateTipsForDeveloper(db, workspaceId, developer.id, cutoff);
    totalTipsCreated += count;
  }

  return totalTipsCreated;
}

async function generateTipsForDeveloper(
  db: DbClient,
  workspaceId: string,
  developerId: string,
  cutoff: string
): Promise<number> {
  // Get existing active/delivered tips to avoid duplicates
  const existingTips = await db
    .select({
      source_type: schema.coaching_tips.source_type,
      source_id: schema.coaching_tips.source_id,
      title: schema.coaching_tips.title,
    })
    .from(schema.coaching_tips)
    .where(
      and(
        eq(schema.coaching_tips.developer_id, developerId),
        inArray(schema.coaching_tips.status, ["active", "delivered"])
      )
    );

  const existingKeys = new Set(
    existingTips.map((t) => `${t.source_type}|${t.source_id ?? t.title}`)
  );

  const candidates: CandidateTip[] = [];

  // Source 1: Facet-based friction patterns
  await collectFrictionTips(db, workspaceId, developerId, cutoff, candidates);

  // Source 2: Repo insights (claude_md_suggestions, friction_analysis)
  const devRepoIds = await getDevRepoIds(db, workspaceId, developerId, cutoff);
  await collectRepoInsightTips(db, workspaceId, devRepoIds, candidates);

  // Source 3: Readiness findings (failed/warned checks, scoped to developer's repos)
  await collectReadinessTips(db, workspaceId, devRepoIds, candidates);

  // Source 4: Context health (high compaction)
  await collectContextHealthTips(db, workspaceId, developerId, cutoff, candidates);

  // Source 5: Curated tips matched by friction category
  await collectCuratedTips(db, workspaceId, developerId, cutoff, candidates);

  // Deduplicate against existing tips
  const filtered = candidates.filter(
    (c) => !existingKeys.has(`${c.source_type}|${c.source_id ?? c.title}`)
  );

  // Sort by score descending, take top N
  filtered.sort((a, b) => b.score - a.score);
  const topTips = filtered.slice(0, TIPS_PER_DEVELOPER);

  if (topTips.length === 0) return 0;

  const expiresAt = new Date(
    Date.now() + TIP_EXPIRY_DAYS * 86_400_000
  ).toISOString();

  await db.insert(schema.coaching_tips).values(
    topTips.map((tip) => ({
      developer_id: developerId,
      repo_id: tip.repo_id,
      workspace_id: workspaceId,
      source_type: tip.source_type,
      source_id: tip.source_id,
      title: tip.title,
      body: tip.body,
      action_type: tip.action_type,
      action_payload: tip.action_payload,
      priority: tip.priority,
      expires_at: expiresAt,
    }))
  );

  return topTips.length;
}

// ── Helpers ─────────────────────────────────────────────────────

async function getDevRepoIds(
  db: DbClient,
  workspaceId: string,
  developerId: string,
  cutoff: string
): Promise<string[]> {
  const devRepos = await db
    .selectDistinct({ repo_id: schema.session_facets.repo_id })
    .from(schema.session_facets)
    .where(
      and(
        eq(schema.session_facets.workspace_id, workspaceId),
        eq(schema.session_facets.developer_entity_id, developerId),
        gte(schema.session_facets.created_at, cutoff)
      )
    );
  return devRepos.map((r) => r.repo_id);
}

// ── Tip Source Collectors ────────────────────────────────────────

async function collectFrictionTips(
  db: DbClient,
  workspaceId: string,
  developerId: string,
  cutoff: string,
  candidates: CandidateTip[]
) {
  const facets = await db
    .select({
      friction_counts: schema.session_facets.friction_counts,
      area: schema.session_facets.area,
      repo_id: schema.session_facets.repo_id,
      repo_key: schema.repos.repo_key,
      created_at: schema.session_facets.created_at,
    })
    .from(schema.session_facets)
    .innerJoin(schema.repos, eq(schema.session_facets.repo_id, schema.repos.id))
    .where(
      and(
        eq(schema.session_facets.workspace_id, workspaceId),
        eq(schema.session_facets.developer_entity_id, developerId),
        gte(schema.session_facets.created_at, cutoff)
      )
    );

  if (facets.length === 0) return;

  const insights = computeFrictionInsights(facets);

  // Generate tips for top 3 friction patterns
  for (const insight of insights.slice(0, 3)) {
    const priority = insight.severity >= 7 ? "high" : insight.severity >= 5 ? "medium" : "low";
    candidates.push({
      source_type: "facet_pattern",
      source_id: null,
      title: `Reduce ${insight.category.replace(/_/g, " ")} friction`,
      body: `Your sessions ${insight.repo_key ? `in ${insight.repo_key} ` : ""}have experienced ${insight.frequency} ${insight.category.replace(/_/g, " ")} events${insight.affected_areas.length > 0 ? ` in ${insight.affected_areas.slice(0, 2).join(", ")}` : ""}. ${insight.description}`,
      action_type: "dismiss",
      action_payload: null,
      priority,
      repo_id: insight.repo_id,
      score: insight.impact_score,
    });
  }
}

async function collectRepoInsightTips(
  db: DbClient,
  workspaceId: string,
  repoIds: string[],
  candidates: CandidateTip[]
) {
  if (repoIds.length === 0) return;

  // Get latest repo insights
  const insights = await db
    .select({
      id: schema.repo_insights.id,
      repo_id: schema.repo_insights.repo_id,
      friction_analysis: schema.repo_insights.friction_analysis,
      claude_md_suggestions: schema.repo_insights.claude_md_suggestions,
      repo_key: schema.repos.repo_key,
    })
    .from(schema.repo_insights)
    .innerJoin(schema.repos, eq(schema.repo_insights.repo_id, schema.repos.id))
    .where(
      and(
        eq(schema.repo_insights.workspace_id, workspaceId),
        inArray(schema.repo_insights.repo_id, repoIds)
      )
    )
    .orderBy(desc(schema.repo_insights.created_at))
    .limit(repoIds.length);

  for (const insight of insights) {
    // CLAUDE.md suggestions
    if (insight.claude_md_suggestions && insight.claude_md_suggestions.length > 0) {
      const suggestion = insight.claude_md_suggestions[0];
      candidates.push({
        source_type: "claude_md",
        source_id: insight.id,
        title: `Add CLAUDE.md rule for ${insight.repo_key}`,
        body: `Repo insight suggests adding to CLAUDE.md: "${suggestion}"`,
        action_type: "copy_to_clipboard",
        action_payload: suggestion,
        priority: "high",
        repo_id: insight.repo_id,
        score: 80,
      });
    }

    // Friction analysis tips
    if (insight.friction_analysis && insight.friction_analysis.length > 0) {
      const topFriction = insight.friction_analysis[0];
      candidates.push({
        source_type: "repo_insight",
        source_id: insight.id,
        title: `Address ${topFriction.category.replace(/_/g, " ")} in ${insight.repo_key}`,
        body: topFriction.detail || `${topFriction.category.replace(/_/g, " ")} was detected ${topFriction.count} times${topFriction.area ? ` in ${topFriction.area}` : ""}.`,
        action_type: "dismiss",
        action_payload: null,
        priority: topFriction.count >= 5 ? "high" : "medium",
        repo_id: insight.repo_id,
        score: topFriction.count * 10,
      });
    }
  }
}

async function collectReadinessTips(
  db: DbClient,
  workspaceId: string,
  repoIds: string[],
  candidates: CandidateTip[]
) {
  if (repoIds.length === 0) return;

  // Get latest scans with failed/warned checks, scoped to developer's repos
  const failedChecks = await db
    .select({
      check_id: schema.repo_scan_checks.check_id,
      title: schema.repo_scan_checks.title,
      description: schema.repo_scan_checks.description,
      recommendation: schema.repo_scan_checks.recommendation,
      severity: schema.repo_scan_checks.severity,
      scan_id: schema.repo_scan_checks.scan_id,
      repo_id: schema.repo_scans.repo_id,
      repo_key: schema.repos.repo_key,
    })
    .from(schema.repo_scan_checks)
    .innerJoin(
      schema.repo_scans,
      eq(schema.repo_scan_checks.scan_id, schema.repo_scans.id)
    )
    .innerJoin(schema.repos, eq(schema.repo_scans.repo_id, schema.repos.id))
    .where(
      and(
        eq(schema.repo_scans.workspace_id, workspaceId),
        inArray(schema.repo_scans.repo_id, repoIds),
        inArray(schema.repo_scan_checks.status, ["fail", "warn"])
      )
    )
    .orderBy(desc(schema.repo_scans.created_at))
    .limit(5);

  for (const check of failedChecks) {
    candidates.push({
      source_type: "readiness",
      source_id: check.scan_id,
      title: check.title,
      body: check.recommendation || check.description,
      action_type: check.recommendation ? "copy_to_clipboard" : "dismiss",
      action_payload: check.recommendation || null,
      priority: check.severity === "critical" ? "high" : check.severity === "warning" ? "medium" : "low",
      repo_id: check.repo_id,
      score: check.severity === "critical" ? 70 : check.severity === "warning" ? 50 : 30,
    });
  }
}

async function collectContextHealthTips(
  db: DbClient,
  workspaceId: string,
  developerId: string,
  cutoff: string,
  candidates: CandidateTip[]
) {
  // Find sessions with high compaction counts
  const healthData = await db
    .select({
      avg_compaction: sql<number>`avg(${schema.run_context_health.compaction_count})::float`,
      avg_peak_util: sql<number>`avg(${schema.run_context_health.peak_utilization_pct})::float`,
      repo_id: schema.run_context_health.repo_id,
      repo_key: schema.repos.repo_key,
    })
    .from(schema.run_context_health)
    .innerJoin(schema.runs, eq(schema.run_context_health.run_id, schema.runs.id))
    .innerJoin(schema.repos, eq(schema.run_context_health.repo_id, schema.repos.id))
    .where(
      and(
        eq(schema.run_context_health.workspace_id, workspaceId),
        eq(schema.runs.developer_entity_id, developerId),
        gte(schema.run_context_health.created_at, cutoff)
      )
    )
    .groupBy(schema.run_context_health.repo_id, schema.repos.repo_key);

  for (const health of healthData) {
    if (health.avg_compaction >= 2 || health.avg_peak_util >= 80) {
      candidates.push({
        source_type: "context_health",
        source_id: null,
        title: `Manage context usage in ${health.repo_key}`,
        body: `Your sessions in ${health.repo_key} average ${Math.round(health.avg_compaction)} compactions with ${Math.round(health.avg_peak_util)}% peak context usage. Try /compact at the 30-minute mark or start shorter, focused sessions.`,
        action_type: "dismiss",
        action_payload: null,
        priority: health.avg_peak_util >= 90 ? "high" : "medium",
        repo_id: health.repo_id,
        score: health.avg_peak_util,
      });
    }
  }
}

async function collectCuratedTips(
  db: DbClient,
  workspaceId: string,
  developerId: string,
  cutoff: string,
  candidates: CandidateTip[]
) {
  // Get developer's friction categories
  const facets = await db
    .select({
      friction_counts: schema.session_facets.friction_counts,
    })
    .from(schema.session_facets)
    .where(
      and(
        eq(schema.session_facets.workspace_id, workspaceId),
        eq(schema.session_facets.developer_entity_id, developerId),
        gte(schema.session_facets.created_at, cutoff)
      )
    );

  const frictionCategories = new Set<string>();
  for (const facet of facets) {
    if (facet.friction_counts) {
      for (const [category, count] of Object.entries(facet.friction_counts)) {
        if (count > 0) frictionCategories.add(category);
      }
    }
  }

  if (frictionCategories.size === 0) return;

  // Get curated tips matching friction categories
  const curatedTips = await db
    .select()
    .from(schema.curated_tips);

  for (const tip of curatedTips) {
    if (tip.friction_match && frictionCategories.has(tip.friction_match)) {
      candidates.push({
        source_type: "curated",
        source_id: tip.id,
        title: tip.title,
        body: tip.body,
        action_type: "dismiss",
        action_payload: null,
        priority: "low",
        repo_id: null,
        score: 20,
      });
    }
  }
}

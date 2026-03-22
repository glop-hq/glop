/**
 * Computes friction insights from session_facets data.
 * Each facet has friction_counts: Record<string, number> and metadata.
 */

interface FacetRow {
  friction_counts: Record<string, number> | null;
  area: string | null;
  repo_key: string | null;
  repo_id: string | null;
  created_at: string;
}

export interface ComputedFriction {
  category: string;
  description: string;
  frequency: number;
  severity: number;
  recency_weight: number;
  impact_score: number;
  affected_areas: string[];
  repo_key: string | null;
  repo_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

// Severity mapping for common friction categories (1-10 scale)
const SEVERITY_MAP: Record<string, number> = {
  permission_friction: 6,
  test_failures: 8,
  build_failures: 8,
  context_confusion: 5,
  wrong_approach: 7,
  missing_context: 6,
  tool_errors: 7,
  slow_response: 3,
  repeated_mistakes: 7,
  scope_creep: 4,
  dependency_issues: 6,
  type_errors: 5,
  lint_errors: 4,
  merge_conflicts: 5,
};

const DEFAULT_SEVERITY = 5;
const DECAY_RATE = 0.05; // per day

export function computeFrictionInsights(facets: FacetRow[]): ComputedFriction[] {
  const now = Date.now();

  // Aggregate by (category, repo_id) so cross-repo friction is tracked separately
  const bucketMap = new Map<
    string,
    {
      category: string;
      totalCount: number;
      areas: Set<string>;
      repoKey: string | null;
      repoId: string | null;
      firstSeen: string;
      lastSeen: string;
      recencySum: number;
    }
  >();

  for (const facet of facets) {
    if (!facet.friction_counts) continue;

    for (const [category, count] of Object.entries(facet.friction_counts)) {
      if (count <= 0) continue;

      const bucketKey = `${category}|${facet.repo_id ?? "_none"}`;
      const entry = bucketMap.get(bucketKey) ?? {
        category,
        totalCount: 0,
        areas: new Set<string>(),
        repoKey: facet.repo_key,
        repoId: facet.repo_id,
        firstSeen: facet.created_at,
        lastSeen: facet.created_at,
        recencySum: 0,
      };

      entry.totalCount += count;
      if (facet.area) entry.areas.add(facet.area);

      if (facet.created_at < entry.firstSeen) entry.firstSeen = facet.created_at;
      if (facet.created_at > entry.lastSeen) entry.lastSeen = facet.created_at;

      // Exponential decay based on days ago
      const daysAgo =
        (now - new Date(facet.created_at).getTime()) / (1000 * 60 * 60 * 24);
      entry.recencySum += count * Math.exp(-DECAY_RATE * daysAgo);

      bucketMap.set(bucketKey, entry);
    }
  }

  // Compute impact scores
  const results: ComputedFriction[] = [];
  for (const [, entry] of bucketMap) {
    const category = entry.category;
    const severity = SEVERITY_MAP[category] ?? DEFAULT_SEVERITY;
    const recency_weight = Math.round(entry.recencySum * 100) / 100;
    const impact_score =
      Math.round(entry.totalCount * severity * recency_weight * 10) / 10;

    results.push({
      category,
      description: formatCategoryDescription(category),
      frequency: entry.totalCount,
      severity,
      recency_weight,
      impact_score,
      affected_areas: Array.from(entry.areas),
      repo_key: entry.repoKey ?? null,
      repo_id: entry.repoId ?? null,
      first_seen_at: entry.firstSeen,
      last_seen_at: entry.lastSeen,
    });
  }

  // Sort by impact score descending
  results.sort((a, b) => b.impact_score - a.impact_score);

  return results;
}

function formatCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    permission_friction: "Sessions blocked by permission requests or denials",
    test_failures: "Test failures causing repeated iterations",
    build_failures: "Build errors requiring multiple fix attempts",
    context_confusion: "AI misunderstanding codebase context or conventions",
    wrong_approach: "AI taking incorrect approaches requiring correction",
    missing_context: "Missing documentation or context slowing AI sessions",
    tool_errors: "Tool execution errors during sessions",
    slow_response: "Slow response times affecting session flow",
    repeated_mistakes: "AI repeating the same mistakes within a session",
    scope_creep: "Sessions expanding beyond original scope",
    dependency_issues: "Dependency or package resolution problems",
    type_errors: "TypeScript or type-related errors",
    lint_errors: "Linting errors requiring fixes",
    merge_conflicts: "Merge conflicts encountered during sessions",
  };
  return (
    descriptions[category] ??
    `${category.replace(/_/g, " ")} issues detected in sessions`
  );
}

import type { AnalyticsPeriod } from "./analytics";

// ── Adoption Overview ──────────────────────────────────────────────

export interface DashboardSummary {
  active_developers: number;
  active_repos: number;
  total_sessions: number;
  avg_effectiveness: number;
  avg_readiness: number | null;
  ai_commits: number;
  ai_prs: number;
  // Period-over-period changes
  active_developers_change: number | null;
  active_repos_change: number | null;
  total_sessions_change: number | null;
  avg_effectiveness_change: number | null;
  ai_commits_change: number | null;
  ai_prs_change: number | null;
}

export interface AdoptionTrendPoint {
  date: string;
  active_developers: number;
  sessions: number;
}

export interface RepoActivityPoint {
  date: string;
  repo_key: string;
  repo_id: string;
  sessions: number;
}

export interface SessionOutcomeBreakdown {
  outcome: string;
  count: number;
}

export interface RepoHeatmapCell {
  repo_key: string;
  repo_id: string;
  date: string;
  sessions: number;
}

export interface DashboardResponse {
  period: AnalyticsPeriod;
  summary: DashboardSummary;
  adoption_trend: AdoptionTrendPoint[];
  activity_by_repo: RepoActivityPoint[];
  session_outcomes: SessionOutcomeBreakdown[];
  repo_heatmap: RepoHeatmapCell[];
}

// ── Per-Repo Drill-Down ────────────────────────────────────────────

export interface RepoDeveloperRow {
  developer_id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  sessions: number;
  commits: number;
  prs: number;
  last_active: string;
  sparkline: number[];
}

export interface RepoFrictionItem {
  category: string;
  count: number;
}

export interface RepoDashboardResponse {
  repo: {
    id: string;
    repo_key: string;
    display_name: string | null;
    language: string | null;
  };
  summary: {
    sessions: number;
    developers: number;
    readiness_score: number | null;
    commits: number;
    prs: number;
    sessions_change: number | null;
  };
  developer_breakdown: RepoDeveloperRow[];
  friction_summary: RepoFrictionItem[];
  success_patterns: string[];
  activity_timeline: { date: string; sessions: number }[];
}

// ── Friction & Success Analytics ───────────────────────────────────

export type FrictionStatus = "open" | "acknowledged" | "resolved" | "wont_fix";

export interface FrictionInsight {
  id: string;
  category: string;
  description: string;
  impact_score: number;
  frequency: number;
  severity: number;
  affected_areas: string[];
  suggested_action: string | null;
  status: FrictionStatus;
  repo_key: string | null;
  repo_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface SuccessPattern {
  pattern: string;
  count: number;
  areas: string[];
}

export interface HotspotEntry {
  area: string;
  friction_count: number;
  session_count: number;
}

export interface InsightsResponse {
  period: AnalyticsPeriod;
  friction_points: FrictionInsight[];
  success_patterns: SuccessPattern[];
  hotspot_map: HotspotEntry[];
}

// ── AI Contribution Metrics ────────────────────────────────────────

export interface RepoContribution {
  repo_id: string;
  repo_key: string;
  display_name: string | null;
  ai_commits: number;
  ai_prs: number;
  sessions: number;
  sessions_with_commits: number;
}

export interface ContributionsResponse {
  period: AnalyticsPeriod;
  summary: {
    total_ai_commits: number;
    total_ai_prs: number;
    sessions_with_commits: number;
    total_sessions: number;
    ai_commits_change: number | null;
    ai_prs_change: number | null;
  };
  by_repo: RepoContribution[];
}

// ── Context Health ────────────────────────────────────────────────

export interface RunContextHealth {
  run_id: string;
  compaction_count: number;
  first_compaction_at_min: number | null;
  peak_utilization_pct: number | null;
  end_utilization_pct: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  context_limit_tokens: number | null;
}

export interface ContextHealthTrendPoint {
  date: string;
  pct_compacted: number;
  avg_compactions: number;
}

export interface ContextHealthSummary {
  pct_sessions_compacted: number;
  avg_compactions_per_session: number;
  avg_duration_before_first_compaction_min: number | null;
  avg_peak_utilization_pct: number | null;
  pct_sessions_above_80: number | null;
  total_sessions_with_data: number;
  trend: ContextHealthTrendPoint[];
}

export interface RepoContextHealthRow extends ContextHealthSummary {
  repo_id: string;
  repo_key: string;
}

export interface RepoContextRecommendation {
  repo_id: string;
  recommended_max_duration_min: number | null;
  confidence: string;
  sample_size: number;
  reasoning: string | null;
}

export interface ContextHealthResponse {
  period: AnalyticsPeriod;
  summary: ContextHealthSummary;
  by_repo: RepoContextHealthRow[];
  recommendations: RepoContextRecommendation[];
}

// ── Digest Schedules ───────────────────────────────────────────────

export type DigestFrequency = "weekly" | "biweekly" | "monthly" | "disabled";

export interface DigestSchedule {
  id: string;
  frequency: DigestFrequency;
  enabled: boolean;
  last_sent_at: string | null;
}

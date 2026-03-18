export type AnalyticsPeriod = "7d" | "30d" | "90d";

export interface AnalyticsSummary {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  avg_conversation_turns: number;
  avg_turns_before_first_commit: number;
  commits_per_run: number;
  prs_per_run: number;
  compactions_per_run: number;
  runs_per_day: number;
}

export interface RunsPerDay {
  date: string;
  completed: number;
  failed: number;
  total: number;
}

export interface DeveloperStats {
  developer_name: string;
  run_count: number;
  avg_conversation_turns: number;
  avg_turns_before_first_commit: number;
  commits_per_run: number;
  prs_per_run: number;
  compactions_per_run: number;
}

export interface TopRepo {
  repo_key: string;
  run_count: number;
}

export interface ActivityBreakdownItem {
  activity_kind: string;
  count: number;
}

export interface RunBreakdown {
  run_id: string;
  label: string;
  started_at: string;
  developer_name: string;
  repo_key: string;
  conversation_turns: number;
  commits: number;
  lines_changed: number;
  prs: number;
  compactions: number;
}

export interface DeveloperOption {
  user_id: string;
  developer_name: string;
}

export interface BusiestHour {
  hour: number;
  run_count: number;
}

export interface AnalyticsResponse {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary;
  runs_per_day: RunsPerDay[];
  run_breakdown: RunBreakdown[];
  developer_stats?: DeveloperStats[];
  developers: DeveloperOption[];
  top_repos: TopRepo[];
  activity_breakdown: ActivityBreakdownItem[];
  busiest_hours: BusiestHour[];
}

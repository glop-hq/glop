export interface Developer {
  id: string;
  workspace_id: string;
  display_name: string | null;
  email: string | null;
  identity_keys: string[];
  avatar_url: string | null;
  first_seen_at: string;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeveloperWithStats extends Developer {
  run_count: number;
}

export interface Repo {
  id: string;
  workspace_id: string;
  repo_key: string;
  display_name: string | null;
  description: string | null;
  default_branch: string | null;
  language: string | null;
  first_seen_at: string;
  last_active_at: string;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepoWithStats extends Repo {
  run_count: number;
}

// ── Scan Types ──────────────────────────────────────────

export interface RepoScan {
  id: string;
  repo_id: string;
  workspace_id: string;
  score: number | null;
  status: "pending" | "completed" | "error";
  triggered_by: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface RepoScanCheck {
  id: string;
  scan_id: string;
  check_id: string;
  status: "pass" | "warn" | "fail" | "skip";
  severity: "critical" | "warning" | "info";
  weight: number;
  score: number;
  title: string;
  description: string;
  recommendation: string | null;
  fix_available: boolean;
  details: Record<string, unknown>;
}

export interface RepoScanDetail extends RepoScan {
  checks: RepoScanCheck[];
}

// ── Claude Items ────────────────────────────────────────

export interface ClaudeItem {
  id: string;
  repo_id: string;
  workspace_id: string;
  kind: "skill" | "command";
  name: string;
  file_path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ClaudeItemWithRepo extends ClaudeItem {
  repo_key: string;
  repo_display_name: string | null;
}

// ── Session Facets ──────────────────────────────────────

export interface SessionFacet {
  id: string;
  run_id: string;
  repo_id: string;
  workspace_id: string;
  developer_entity_id: string | null;
  developer_id: string;
  goal_categories: Record<string, number>;
  outcome: string;
  satisfaction: string;
  session_type: string;
  friction_counts: Record<string, number>;
  friction_detail: string | null;
  primary_success: string | null;
  files_touched: string[];
  area: string | null;
  brief_summary: string;
  duration_minutes: number | null;
  iteration_count: number | null;
  created_at: string;
}

export interface RepoInsight {
  id: string;
  repo_id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  session_count: number;
  developer_count: number;
  outcome_distribution: Record<string, number>;
  friction_analysis: Array<{
    category: string;
    count: number;
    area: string | null;
    detail: string;
  }>;
  success_patterns: Array<{
    pattern: string;
    area: string | null;
    detail: string;
  }>;
  claude_md_suggestions: string[];
  file_coupling: Array<{ files: string[]; frequency: number }>;
  area_complexity: Array<{
    area: string;
    avg_iterations: number;
    avg_friction_count: number;
  }>;
  generated_by: string;
  created_at: string;
}

export interface RepoWithScanStats extends RepoWithStats {
  latest_scan_score: number | null;
  latest_scan_status: string | null;
  latest_scan_at: string | null;
  critical_count: number;
  warning_count: number;
}

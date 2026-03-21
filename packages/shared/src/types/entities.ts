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

export interface RepoWithScanStats extends RepoWithStats {
  latest_scan_score: number | null;
  latest_scan_status: string | null;
  latest_scan_at: string | null;
  critical_count: number;
  warning_count: number;
}

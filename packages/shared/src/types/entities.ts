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
  created_at: string;
  updated_at: string;
}

export interface RepoWithStats extends Repo {
  run_count: number;
}

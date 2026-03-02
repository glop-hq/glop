export type RunStatus = "active" | "blocked" | "stale" | "completed" | "failed";

export type RunPhase =
  | "editing"
  | "validating"
  | "waiting"
  | "done"
  | "failed"
  | "unknown";

export type ActivityKind =
  | "editing"
  | "reading"
  | "test_run"
  | "build_run"
  | "check_run"
  | "git_action"
  | "deploy_action"
  | "install_deps"
  | "web_fetch"
  | "web_search"
  | "ask_user"
  | "plan_mode"
  | "todo_action"
  | "skill_invoke"
  | "docker_action"
  | "waiting"
  | "blocked"
  | "unknown";

export type RunVisibility = "private" | "workspace" | "shared_link";

export type SharedLinkState = "active" | "revoked";

export interface Run {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  developer_id: string;
  machine_id: string;
  repo_key: string;
  branch_name: string;
  session_id: string | null;
  slug: string | null;
  status: RunStatus;
  phase: RunPhase;
  activity_kind: ActivityKind;
  git_user_name: string | null;
  git_user_email: string | null;
  title: string | null;
  summary: string | null;
  current_action: string | null;
  last_action_label: string | null;
  file_count: number;
  files_touched: string[];
  visibility: RunVisibility;
  shared_link_id: string | null;
  shared_link_token_hash: string | null;
  shared_link_state: SharedLinkState | null;
  shared_link_expires_at: string | null;
  share_created_at: string | null;
  started_at: string;
  last_heartbeat_at: string;
  last_event_at: string;
  completed_at: string | null;
  event_count: number;
  created_at: string;
  updated_at: string;
}

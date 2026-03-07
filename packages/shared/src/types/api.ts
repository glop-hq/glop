import type { Run, RunStatus } from "./runs";
import type { Event } from "./events";

export interface ArtifactInfo {
  id: string;
  run_id: string;
  artifact_type: "pr" | "preview" | "ci" | "commit";
  url: string | null;
  label: string | null;
  external_id: string | null;
  state: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IngestHookRequest {
  // Raw hook payload from Claude Code - passed through as-is
  [key: string]: unknown;
}

export interface IngestHookResponse {
  run_id: string;
  event_id: string;
}

export interface LiveBoardResponse {
  runs: (Run & { artifacts: ArtifactInfo[] })[];
  updated_at: string;
}

export interface RunLink {
  id: string;
  status: RunStatus;
  started_at: string;
}

export interface RunDetailResponse {
  run: Run;
  events: Event[];
  artifacts: ArtifactInfo[];
  parent_run?: RunLink;
  child_runs?: RunLink[];
}

export interface HistoryResponse {
  runs: (Run & { artifacts: ArtifactInfo[] })[];
  total: number;
  offset: number;
  limit: number;
}

export interface AuthRegisterRequest {
  developer_name: string;
}

export interface AuthRegisterResponse {
  api_key: string;
  developer_id: string;
}

export interface ApiError {
  error: string;
  code: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberResponse {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "admin" | "member";
  created_at: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  created_at: string;
}

export interface AuthMeResponse {
  user: UserResponse;
  workspaces: WorkspaceResponse[];
}

export interface ShareRunRequest {
  action: "share_workspace" | "unshare_workspace" | "create_link" | "revoke_link";
  expires_in_days?: number | null;
}

export interface ShareRunResponse {
  visibility: "private" | "workspace";
  shared_link_active: boolean;
  shared_link_url?: string;
  shared_link_expires_at?: string;
}

export interface SharedRunDetailResponse {
  run: Run;
  events: Event[];
  artifacts: ArtifactInfo[];
  shared: true;
  parent_run?: RunLink;
  child_runs?: RunLink[];
}

export interface InvitationResponse {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "revoked";
  invited_by: string;
  expires_at: string;
  created_at: string;
  inviter?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface InviteLinkResponse {
  id: string;
  workspace_id: string;
  token: string;
  url: string;
  role: "admin" | "member";
  enabled: boolean;
  created_at: string;
}

export interface JoinWorkspaceResponse {
  workspace_id: string;
  workspace_name: string;
  role: "admin" | "member";
}

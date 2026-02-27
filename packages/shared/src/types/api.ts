import type { Run } from "./runs";
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

export interface RunDetailResponse {
  run: Run;
  events: Event[];
  artifacts: ArtifactInfo[];
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

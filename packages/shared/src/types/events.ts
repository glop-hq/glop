export type EventType =
  | "run.started"
  | "run.heartbeat"
  | "run.phase_changed"
  | "run.completed"
  | "run.failed"
  | "run.prompt"
  | "run.response"
  | "run.tool_use"
  | "run.permission_request"
  | "run.title_updated"
  | "run.summary_updated"
  | "run.context_compacted"
  | "artifact.added"
  | "artifact.updated";

export interface Event {
  id: string;
  event_type: EventType;
  occurred_at: string;
  received_at: string;
  run_id: string;
  developer_id: string;
  machine_id: string;
  repo_key: string;
  branch_name: string;
  payload: Record<string, unknown>;
}

export type HookType =
  | "PostToolUse"
  | "PreToolUse"
  | "PreCompact"
  | "PermissionRequest"
  | "Stop"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd";

export interface RawHookPayload {
  hook_type?: HookType;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: string;
  session_id?: string;
  cwd?: string;
  stdout?: string;
  stderr?: string;
  prompt?: string;
  last_assistant_message?: string;
  source?: string;
  reason?: string;
  [key: string]: unknown;
}

import type { Run, RunStatus, RunPhase, ActivityKind, EventType } from "./types/index";
import { STALE_THRESHOLD_MS, AUTO_CLOSE_THRESHOLD_MS, SECRET_PATTERNS } from "./constants";

export interface ClassifiedActivity {
  activity_kind: ActivityKind;
  phase: RunPhase;
  action_label: string;
  files_touched: string[];
}

export interface RunPatch {
  status?: RunStatus;
  phase?: RunPhase;
  activity_kind?: ActivityKind;
  current_action?: string | null;
  last_action_label?: string | null;
  file_count?: number;
  files_touched?: string[];
  last_heartbeat_at?: string;
  last_event_at?: string;
  completed_at?: string | null;
  event_count?: number;
  updated_at?: string;
}

export function deriveRunPatch(
  currentRun: Run,
  eventType: EventType,
  activity: ClassifiedActivity | null,
  now: string
): RunPatch {
  const patch: RunPatch = {
    last_event_at: now,
    last_heartbeat_at: now,
    event_count: currentRun.event_count + 1,
    updated_at: now,
  };

  switch (eventType) {
    case "run.started":
      patch.status = "active";
      patch.phase = "unknown";
      break;

    case "run.heartbeat":
      // Heartbeat reactivates stale or completed runs (same session resumed)
      if (currentRun.status === "stale" || currentRun.status === "completed" || currentRun.status === "failed") {
        patch.status = "active";
        patch.completed_at = null;
      }
      if (activity) {
        patch.activity_kind = activity.activity_kind;
        patch.phase = activity.phase;
        patch.current_action = activity.action_label;
        patch.last_action_label = activity.action_label;
        if (activity.files_touched.length > 0) {
          const merged = new Set(currentRun.files_touched || []);
          for (const f of activity.files_touched) merged.add(f);
          patch.files_touched = [...merged];
          patch.file_count = merged.size;
        }
      }
      break;

    case "run.phase_changed":
      if (activity) {
        patch.phase = activity.phase;
        patch.activity_kind = activity.activity_kind;
        patch.current_action = activity.action_label;
        patch.last_action_label = activity.action_label;
      }
      break;

    case "run.completed":
      patch.status = "completed";
      patch.phase = "done";
      patch.completed_at = now;
      patch.current_action = null;
      break;

    case "run.failed":
      patch.status = "failed";
      patch.phase = "failed";
      patch.completed_at = now;
      patch.current_action = null;
      break;

    case "run.title_updated":
    case "run.summary_updated":
    case "artifact.added":
    case "artifact.updated":
      // These don't change run phase/status
      break;
  }

  return patch;
}

export interface TimeBasedUpdate {
  status: RunStatus;
  completed_at?: string;
}

export function deriveTimeBasedStatus(
  run: Run,
  now: Date
): TimeBasedUpdate | null {
  if (run.status === "completed" || run.status === "failed") {
    return null;
  }

  const lastHeartbeat = new Date(run.last_heartbeat_at).getTime();
  const elapsed = now.getTime() - lastHeartbeat;

  if (elapsed >= AUTO_CLOSE_THRESHOLD_MS) {
    return {
      status: "completed",
      completed_at: now.toISOString(),
    };
  }

  if (elapsed >= STALE_THRESHOLD_MS && run.status !== "stale") {
    return { status: "stale" };
  }

  return null;
}

export function shouldCreateNewRun(
  existingRun: Run | null,
  matchedBySessionId: boolean = false
): boolean {
  if (!existingRun) return true;
  // If we matched by session_id, reuse the run even if completed/failed
  if (matchedBySessionId) return false;
  if (existingRun.status === "completed" || existingRun.status === "failed") {
    return true;
  }
  return false;
}

// ── Access Control ──────────────────────────────────────

export interface ViewerContext {
  viewer_user_id: string;
  viewer_workspace_ids: string[];
}

export function canViewRun(
  run: Run,
  ctx: ViewerContext | null
): boolean {
  // Owner can always see their own runs
  if (ctx && run.owner_user_id && run.owner_user_id === ctx.viewer_user_id) {
    return true;
  }

  // Workspace members can see runs in their workspaces
  if (ctx && ctx.viewer_workspace_ids.includes(run.workspace_id)) {
    return true;
  }

  // Shared runs are visible to anyone (if not expired)
  if (run.shared_link_state === "active") {
    if (run.shared_link_expires_at) {
      const expiresAt = new Date(run.shared_link_expires_at).getTime();
      if (Date.now() > expiresAt) return false;
    }
    return true;
  }

  return false;
}

export function filterVisibleRuns(
  runs: Run[],
  ctx: ViewerContext
): Run[] {
  return runs.filter((run) => canViewRun(run, ctx));
}

// ── Secret Redaction ────────────────────────────────────

export function redactSecrets(input: string): string {
  let result = input;
  for (const pattern of SECRET_PATTERNS) {
    // Reset lastIndex for stateful regexes (global flag)
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function redactEventPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return deepRedact(payload) as Record<string, unknown>;
}

function deepRedact(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecrets(value);
  }
  if (Array.isArray(value)) {
    return value.map(deepRedact);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = deepRedact(v);
    }
    return result;
  }
  return value;
}

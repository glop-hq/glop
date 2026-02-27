import { z } from "zod";

export const runStatusSchema = z.enum([
  "active",
  "blocked",
  "stale",
  "completed",
  "failed",
]);

export const runPhaseSchema = z.enum([
  "editing",
  "validating",
  "waiting",
  "done",
  "failed",
  "unknown",
]);

export const activityKindSchema = z.enum([
  "editing",
  "reading",
  "test_run",
  "build_run",
  "check_run",
  "git_action",
  "deploy_action",
  "waiting",
  "blocked",
  "unknown",
]);

export const eventTypeSchema = z.enum([
  "run.started",
  "run.heartbeat",
  "run.phase_changed",
  "run.completed",
  "run.failed",
  "run.prompt",
  "run.response",
  "run.tool_use",
  "run.permission_request",
  "run.title_updated",
  "run.summary_updated",
  "artifact.added",
  "artifact.updated",
]);

export const hookTypeSchema = z.enum([
  "PostToolUse",
  "PreToolUse",
  "PermissionRequest",
  "Stop",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
]);

export const rawHookPayloadSchema = z
  .object({
    hook_type: hookTypeSchema.optional(),
    tool_name: z.string().optional(),
    tool_input: z.record(z.unknown()).optional(),
    session_id: z.string().optional(),
    cwd: z.string().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    prompt: z.string().optional(),
    last_assistant_message: z.string().optional(),
    tool_response: z.string().optional(),
    source: z.string().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

export const ingestEventSchema = z.object({
  event_type: eventTypeSchema,
  run_id: z.string().optional(),
  repo_key: z.string(),
  branch_name: z.string(),
  payload: z.record(z.unknown()).default({}),
});

export const authRegisterSchema = z.object({
  developer_name: z.string().min(1).max(100),
});

export const historyQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

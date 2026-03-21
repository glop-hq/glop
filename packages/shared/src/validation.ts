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
  "install_deps",
  "web_fetch",
  "web_search",
  "ask_user",
  "plan_mode",
  "todo_action",
  "skill_invoke",
  "docker_action",
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
  "run.context_compacted",
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

export const runVisibilitySchema = z.enum(["private", "workspace"]);

export const memberRoleSchema = z.enum(["admin", "member"]);

export const workspaceCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const workspaceCreateRequestSchema = z.object({
  name: z.string().min(1).max(100),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  default_run_visibility: runVisibilitySchema.optional(),
});

export const memberInviteSchema = z.object({
  email: z.string().email(),
  role: memberRoleSchema.default("member"),
});

export const shareActionSchema = z.enum([
  "share_workspace",
  "unshare_workspace",
  "create_link",
  "revoke_link",
]);

export const shareRunSchema = z.object({
  action: shareActionSchema,
  expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
});

export const inviteLinkCreateSchema = z.object({
  role: memberRoleSchema.default("member"),
});

export const inviteLinkUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  role: memberRoleSchema.optional(),
});

export const analyticsPeriodSchema = z.enum(["7d", "30d", "90d"]);

export const analyticsQuerySchema = z.object({
  period: analyticsPeriodSchema.default("7d"),
  user_id: z.string().uuid().optional(),
});

export const developerUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export const developerMergeSchema = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
});

export const repoUpdateSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  default_branch: z.string().max(100).optional(),
  language: z.string().max(50).optional(),
});

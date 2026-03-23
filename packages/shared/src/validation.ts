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

export const dashboardQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  period: analyticsPeriodSchema.default("7d"),
});

export const frictionStatusUpdateSchema = z.object({
  workspace_id: z.string().uuid(),
  status: z.enum(["open", "acknowledged", "resolved", "wont_fix"]),
});

export const digestSettingsSchema = z.object({
  workspace_id: z.string().uuid(),
  frequency: z.enum(["weekly", "biweekly", "monthly", "disabled"]),
  enabled: z.boolean(),
});

export const developerUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export const developerMergeSchema = z.object({
  source_id: z.string().uuid(),
  target_id: z.string().uuid(),
});

// ── MCP Visibility & Compliance ──────────────────────────────────

export const mcpSyncSchema = z.object({
  workspace_id: z.string().uuid(),
  repo_key: z.string().min(1),
  mcps: z.array(
    z.object({
      server_name: z.string().min(1),
      canonical_id: z.string().min(1),
      transport: z.enum(["http", "sse", "stdio"]),
    })
  ),
});

export const mcpStatusUpdateSchema = z.object({
  workspace_id: z.string().uuid(),
  status: z.enum(["pending", "approved", "flagged", "blocked"]),
  display_name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  setup_guidance: z.string().max(5000).optional(),
  status_note: z.string().max(1000).optional(),
});

export const mcpCreateSchema = z.object({
  workspace_id: z.string().uuid(),
  canonical_id: z.string().min(1),
  transport: z.enum(["http", "sse", "stdio"]),
  display_name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["pending", "approved", "flagged", "blocked"]).default("approved"),
  setup_guidance: z.string().max(5000).optional(),
});

export const mcpQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  status: z.enum(["pending", "approved", "flagged", "blocked"]).optional(),
  period: analyticsPeriodSchema.default("30d"),
});

export const mcpAlertAcknowledgeSchema = z.object({
  workspace_id: z.string().uuid(),
});

export const repoUpdateSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  default_branch: z.string().max(100).optional(),
  language: z.string().max(50).optional(),
});

export const scanCheckResultSchema = z.object({
  check_id: z.string(),
  status: z.enum(["pass", "warn", "fail", "skip"]),
  severity: z.enum(["critical", "warning", "info"]),
  weight: z.number().int().min(0).max(100),
  score: z.number().int().min(0).max(100),
  title: z.string(),
  description: z.string(),
  recommendation: z.string().nullable().optional(),
  fix_available: z.boolean().default(false),
  details: z.record(z.unknown()).default({}),
});

export const claudeItemSchema = z.object({
  kind: z.enum(["skill", "command"]),
  name: z.string().min(1).max(200),
  file_path: z.string().min(1),
  content: z.string().min(1).max(50000),
});

export const sessionFacetSchema = z.object({
  run_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  repo_key: z.string().min(1),
  developer_id: z.string().min(1),
  goal_categories: z.record(z.number().int().min(0)),
  outcome: z.enum([
    "fully_achieved",
    "mostly_achieved",
    "partially_achieved",
    "not_achieved",
    "unclear",
  ]),
  satisfaction: z.enum([
    "frustrated",
    "dissatisfied",
    "likely_satisfied",
    "satisfied",
    "happy",
    "unsure",
  ]),
  session_type: z.enum([
    "single_task",
    "multi_task",
    "iterative_refinement",
    "exploration",
    "quick_question",
  ]),
  friction_counts: z.record(z.number().int().min(0)),
  friction_detail: z.string().nullable().optional(),
  primary_success: z.string().nullable().optional(),
  files_touched: z.array(z.string()).optional().default([]),
  area: z.string().nullable().optional(),
  brief_summary: z.string().min(1),
  duration_minutes: z.number().int().min(0).nullable().optional(),
  iteration_count: z.number().int().min(0).nullable().optional(),
});

export const repoInsightSchema = z.object({
  workspace_id: z.string().uuid(),
  repo_key: z.string().min(1),
  period_start: z.string(),
  period_end: z.string(),
  session_count: z.number().int().min(0),
  developer_count: z.number().int().min(0),
  outcome_distribution: z.record(z.number().int().min(0)),
  friction_analysis: z.array(
    z.object({
      category: z.string(),
      count: z.number().int(),
      area: z.string().nullable(),
      detail: z.string(),
    })
  ),
  success_patterns: z.array(
    z.object({
      pattern: z.string(),
      area: z.string().nullable(),
      detail: z.string(),
    })
  ),
  claude_md_suggestions: z.array(z.string()),
  file_coupling: z.array(
    z.object({
      files: z.array(z.string()),
      frequency: z.number(),
    })
  ),
  area_complexity: z.array(
    z.object({
      area: z.string(),
      avg_iterations: z.number(),
      avg_friction_count: z.number(),
    })
  ),
});

export const contextHealthSchema = z.object({
  run_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  repo_key: z.string().min(1),
  compaction_count: z.number().int().min(0),
  first_compaction_at_min: z.number().min(0).nullable().optional(),
  peak_utilization_pct: z.number().min(0).max(100).nullable().optional(),
  end_utilization_pct: z.number().min(0).max(100).nullable().optional(),
  total_input_tokens: z.number().int().min(0).nullable().optional(),
  total_output_tokens: z.number().int().min(0).nullable().optional(),
  context_limit_tokens: z.number().int().min(0).nullable().optional(),
});

export const extractedDirectiveSchema = z.object({
  directive: z.string().min(1),
  source_file: z.string().min(1),
  source_line: z.number().int().min(1),
  category: z.string().min(1),
});

export const scanResultSchema = z.object({
  workspace_id: z.string().uuid(),
  repo_key: z.string().min(1),
  score: z.number().int().min(0).max(100),
  checks: z.array(scanCheckResultSchema).min(1),
  claude_items: z.array(claudeItemSchema).optional().default([]),
  directives: z.array(extractedDirectiveSchema).optional().default([]),
  started_at: z.string(),
  completed_at: z.string(),
  error_message: z.string().nullable().optional(),
});

// ── Smart Suggestions ──────────────────────────────────────────────

export const suggestionItemSchema = z.object({
  suggestion_type: z.enum(["skill", "command", "hook"]),
  title: z.string().min(1).max(200),
  rationale: z.string().min(1).max(2000),
  draft_content: z.string().min(1).max(50000),
  draft_filename: z.string().min(1).max(500),
  pattern_type: z.string().min(1).max(100),
  pattern_data: z.record(z.unknown()).default({}),
});

export const standardSuggestionSubmitSchema = z.object({
  workspace_id: z.string().uuid(),
  repo_key: z.string().min(1),
  suggestions: z.array(suggestionItemSchema).min(1).max(10),
});

export const suggestionStatusUpdateSchema = z.object({
  status: z.enum(["accepted", "dismissed"]),
  dismiss_reason: z
    .enum(["not_relevant", "already_handled", "will_do_later"])
    .optional(),
});

// ── Coaching Tips (PRD 11) ──────────────────────────────────────

export const coachingSourceTypeSchema = z.enum([
  "repo_insight",
  "readiness",
  "facet_pattern",
  "context_health",
  "claude_md",
  "standard",
  "curated",
]);

export const tipActionTypeSchema = z.enum([
  "copy_to_clipboard",
  "open_link",
  "dismiss",
]);

export const tipPrioritySchema = z.enum(["high", "medium", "low"]);

export const tipStatusSchema = z.enum([
  "active",
  "delivered",
  "engaged",
  "dismissed",
  "expired",
]);

export const coachingTipQuerySchema = z.object({
  workspace_id: z.string().uuid(),
  developer_id: z.string().uuid().optional(),
  repo_key: z.string().optional(),
  channel: z.enum(["cli", "dashboard"]).optional(),
  status: tipStatusSchema.optional(),
});

export const coachingTipUpdateSchema = z.object({
  status: z.enum(["delivered", "engaged", "dismissed"]),
  dismiss_reason: z.string().max(500).optional(),
});

export const coachingGenerateSchema = z.object({
  workspace_id: z.string().uuid(),
});

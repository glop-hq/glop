import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  real,
  date,
  index,
  uuid,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────

export const runStatusEnum = pgEnum("run_status", [
  "active",
  "blocked",
  "stale",
  "completed",
  "failed",
]);

export const runPhaseEnum = pgEnum("run_phase", [
  "editing",
  "validating",
  "waiting",
  "done",
  "failed",
  "unknown",
]);

export const activityKindEnum = pgEnum("activity_kind", [
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

export const eventTypeEnum = pgEnum("event_type", [
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

export const artifactTypeEnum = pgEnum("artifact_type", [
  "pr",
  "preview",
  "ci",
  "commit",
]);

export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);

export const runVisibilityEnum = pgEnum("run_visibility", [
  "private",
  "workspace",
]);

export const sharedLinkStateEnum = pgEnum("shared_link_state", [
  "active",
  "revoked",
]);

export const accessRequestStatusEnum = pgEnum("access_request_status", [
  "pending",
]);

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "completed",
  "error",
]);

export const checkStatusEnum = pgEnum("check_status", [
  "pass",
  "warn",
  "fail",
  "skip",
]);

export const scanSeverityEnum = pgEnum("scan_severity", [
  "critical",
  "warning",
  "info",
]);

export const claudeItemKindEnum = pgEnum("claude_item_kind", [
  "skill",
  "command",
]);

// ── Tables ─────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name"),
    avatar_url: text("avatar_url"),
    provider: text("provider").notNull(),
    provider_account_id: text("provider_account_id").notNull(),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_provider_account_idx").on(
      table.provider,
      table.provider_account_id
    ),
  ]
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
  default_run_visibility: runVisibilityEnum("default_run_visibility").notNull().default("workspace"),
});

export const workspace_members = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_unique_idx").on(
      table.workspace_id,
      table.user_id
    ),
  ]
);

export const developers = pgTable(
  "developers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    display_name: text("display_name"),
    email: text("email"),
    identity_keys: jsonb("identity_keys")
      .$type<string[]>()
      .notNull()
      .default([]),
    avatar_url: text("avatar_url"),
    first_seen_at: timestamp("first_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_active_at: timestamp("last_active_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("developers_workspace_id_idx").on(table.workspace_id),
    uniqueIndex("developers_workspace_email_idx")
      .on(table.workspace_id, table.email)
      .where(sql`email IS NOT NULL`),
  ]
);

export const repos = pgTable(
  "repos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    repo_key: text("repo_key").notNull(),
    display_name: text("display_name"),
    description: text("description"),
    default_branch: text("default_branch"),
    language: text("language"),
    first_seen_at: timestamp("first_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_active_at: timestamp("last_active_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_scanned_at: timestamp("last_scanned_at", {
      mode: "string",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repos_workspace_id_idx").on(table.workspace_id),
    uniqueIndex("repos_workspace_repo_key_idx").on(
      table.workspace_id,
      table.repo_key
    ),
  ]
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    owner_user_id: uuid("owner_user_id").references(() => users.id),
    developer_entity_id: uuid("developer_entity_id").references(
      () => developers.id
    ),
    repo_id: uuid("repo_id").references(() => repos.id),
    developer_id: text("developer_id").notNull(),
    machine_id: text("machine_id").notNull(),
    repo_key: text("repo_key").notNull(),
    branch_name: text("branch_name").notNull(),
    session_id: text("session_id"),
    slug: text("slug"),
    status: runStatusEnum("status").notNull().default("active"),
    phase: runPhaseEnum("phase").notNull().default("unknown"),
    activity_kind: activityKindEnum("activity_kind")
      .notNull()
      .default("unknown"),
    git_user_name: text("git_user_name"),
    git_user_email: text("git_user_email"),
    title: text("title"),
    summary: text("summary"),
    current_action: text("current_action"),
    last_action_label: text("last_action_label"),
    file_count: integer("file_count").notNull().default(0),
    files_touched: jsonb("files_touched")
      .$type<string[]>()
      .notNull()
      .default([]),
    visibility: runVisibilityEnum("visibility").notNull().default("private"),
    shared_link_state: sharedLinkStateEnum("shared_link_state"),
    shared_link_expires_at: timestamp("shared_link_expires_at", {
      mode: "string",
      withTimezone: true,
    }),
    share_created_at: timestamp("share_created_at", {
      mode: "string",
      withTimezone: true,
    }),
    started_at: timestamp("started_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_heartbeat_at: timestamp("last_heartbeat_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_event_at: timestamp("last_event_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    parent_run_id: uuid("parent_run_id"),
    completed_at: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    }),
    event_count: integer("event_count").notNull().default(0),
    created_at: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updated_at: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("runs_status_idx").on(table.status),
    index("runs_last_event_at_idx").on(table.last_event_at),
    index("runs_identity_idx").on(
      table.developer_id,
      table.machine_id,
      table.repo_key,
      table.branch_name
    ),
    index("runs_session_id_idx").on(table.session_id),
    index("runs_slug_idx").on(table.slug),
    index("runs_workspace_id_idx").on(table.workspace_id),
    index("runs_owner_user_id_idx").on(table.owner_user_id),
    index("runs_visibility_idx").on(table.visibility),
    index("runs_parent_run_id_idx").on(table.parent_run_id),
    index("runs_developer_entity_id_idx").on(table.developer_entity_id),
    index("runs_repo_id_idx").on(table.repo_id),
  ]
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey(),
    event_type: eventTypeEnum("event_type").notNull(),
    occurred_at: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    received_at: timestamp("received_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    developer_id: text("developer_id").notNull(),
    machine_id: text("machine_id").notNull(),
    repo_key: text("repo_key").notNull(),
    branch_name: text("branch_name").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [
    index("events_run_id_idx").on(table.run_id),
    index("events_occurred_at_idx").on(table.occurred_at),
  ]
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    artifact_type: artifactTypeEnum("artifact_type").notNull(),
    url: text("url"),
    label: text("label"),
    external_id: text("external_id"),
    state: text("state"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    created_at: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("artifacts_run_id_idx").on(table.run_id)]
);

export const workspace_invitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invited_by: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    expires_at: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    accepted_at: timestamp("accepted_at", {
      mode: "string",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_invitations_workspace_id_idx").on(table.workspace_id),
    index("workspace_invitations_email_status_idx").on(
      table.email,
      table.status
    ),
  ]
);

export const workspace_invite_links = pgTable(
  "workspace_invite_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" })
      .unique(),
    token: text("token").notNull().unique(),
    role: memberRoleEnum("role").notNull().default("member"),
    enabled: boolean("enabled").notNull().default(true),
    created_by: uuid("created_by")
      .notNull()
      .references(() => users.id),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

export const access_requests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    requester_user_id: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    owner_user_id: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: accessRequestStatusEnum("status").notNull().default("pending"),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("access_requests_run_requester_idx").on(
      table.run_id,
      table.requester_user_id
    ),
    index("access_requests_owner_user_id_idx").on(table.owner_user_id),
  ]
);

export const repo_scans = pgTable(
  "repo_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repo_id: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    score: integer("score"),
    status: scanStatusEnum("status").notNull().default("pending"),
    triggered_by: text("triggered_by").notNull(),
    error_message: text("error_message"),
    started_at: timestamp("started_at", {
      mode: "string",
      withTimezone: true,
    }),
    completed_at: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repo_scans_repo_id_idx").on(table.repo_id),
    index("repo_scans_repo_id_created_at_idx").on(
      table.repo_id,
      table.created_at
    ),
  ]
);

export const repo_scan_checks = pgTable(
  "repo_scan_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scan_id: uuid("scan_id")
      .notNull()
      .references(() => repo_scans.id, { onDelete: "cascade" }),
    check_id: text("check_id").notNull(),
    status: checkStatusEnum("status").notNull(),
    severity: scanSeverityEnum("severity").notNull(),
    weight: integer("weight").notNull(),
    score: integer("score").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation"),
    fix_available: boolean("fix_available").notNull().default(false),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (table) => [index("repo_scan_checks_scan_id_idx").on(table.scan_id)]
);

export const claude_items = pgTable(
  "claude_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repo_id: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    kind: claudeItemKindEnum("kind").notNull(),
    name: text("name").notNull(),
    file_path: text("file_path").notNull(),
    content: text("content").notNull(),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("claude_items_workspace_id_idx").on(table.workspace_id),
    index("claude_items_repo_id_idx").on(table.repo_id),
    uniqueIndex("claude_items_repo_kind_name_idx").on(
      table.repo_id,
      table.kind,
      table.name
    ),
  ]
);

export const session_facets = pgTable(
  "session_facets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => runs.id)
      .unique(),
    repo_id: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    developer_entity_id: uuid("developer_entity_id").references(
      () => developers.id
    ),
    developer_id: text("developer_id").notNull(),
    goal_categories: jsonb("goal_categories")
      .$type<Record<string, number>>()
      .notNull(),
    outcome: text("outcome").notNull(),
    satisfaction: text("satisfaction").notNull(),
    session_type: text("session_type").notNull(),
    friction_counts: jsonb("friction_counts")
      .$type<Record<string, number>>()
      .notNull(),
    friction_detail: text("friction_detail"),
    primary_success: text("primary_success"),
    files_touched: jsonb("files_touched")
      .$type<string[]>()
      .notNull()
      .default([]),
    area: text("area"),
    brief_summary: text("brief_summary").notNull(),
    duration_minutes: integer("duration_minutes"),
    iteration_count: integer("iteration_count"),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("session_facets_repo_id_created_at_idx").on(
      table.repo_id,
      table.created_at
    ),
    index("session_facets_workspace_id_created_at_idx").on(
      table.workspace_id,
      table.created_at
    ),
  ]
);

export const repo_insights = pgTable(
  "repo_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repo_id: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    period_start: date("period_start", { mode: "string" }).notNull(),
    period_end: date("period_end", { mode: "string" }).notNull(),
    session_count: integer("session_count").notNull(),
    developer_count: integer("developer_count").notNull(),
    outcome_distribution: jsonb("outcome_distribution")
      .$type<Record<string, number>>()
      .notNull(),
    friction_analysis: jsonb("friction_analysis")
      .$type<
        Array<{
          category: string;
          count: number;
          area: string | null;
          detail: string;
        }>
      >()
      .notNull(),
    success_patterns: jsonb("success_patterns")
      .$type<
        Array<{
          pattern: string;
          area: string | null;
          detail: string;
        }>
      >()
      .notNull(),
    claude_md_suggestions: jsonb("claude_md_suggestions")
      .$type<string[]>()
      .notNull(),
    file_coupling: jsonb("file_coupling")
      .$type<Array<{ files: string[]; frequency: number }>>()
      .notNull(),
    area_complexity: jsonb("area_complexity")
      .$type<
        Array<{
          area: string;
          avg_iterations: number;
          avg_friction_count: number;
        }>
      >()
      .notNull(),
    generated_by: text("generated_by").notNull(),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repo_insights_repo_id_created_at_idx").on(
      table.repo_id,
      table.created_at
    ),
    index("repo_insights_workspace_id_idx").on(table.workspace_id),
  ]
);

// ── Dashboard: Friction & Digests ──────────────────────

export const frictionStatusEnum = pgEnum("friction_status", [
  "open",
  "acknowledged",
  "resolved",
  "wont_fix",
]);

export const digestFrequencyEnum = pgEnum("digest_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "disabled",
]);

export const friction_insights = pgTable(
  "friction_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    repo_id: uuid("repo_id").references(() => repos.id, {
      onDelete: "cascade",
    }),
    category: text("category").notNull(),
    description: text("description").notNull(),
    frequency: integer("frequency").notNull(),
    severity: integer("severity").notNull(),
    recency_weight: real("recency_weight").notNull(),
    impact_score: real("impact_score").notNull(),
    affected_areas: jsonb("affected_areas")
      .$type<string[]>()
      .notNull()
      .default([]),
    suggested_action: text("suggested_action"),
    status: frictionStatusEnum("status").notNull().default("open"),
    first_seen_at: timestamp("first_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_seen_at: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    resolved_at: timestamp("resolved_at", {
      mode: "string",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("friction_insights_workspace_id_idx").on(table.workspace_id),
    index("friction_insights_impact_score_idx").on(table.impact_score),
    index("friction_insights_repo_id_idx").on(table.repo_id),
  ]
);

export const digest_schedules = pgTable(
  "digest_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    frequency: digestFrequencyEnum("frequency").notNull().default("weekly"),
    enabled: boolean("enabled").notNull().default(true),
    last_sent_at: timestamp("last_sent_at", {
      mode: "string",
      withTimezone: true,
    }),
    created_at: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("digest_schedules_user_workspace_idx").on(
      table.user_id,
      table.workspace_id
    ),
  ]
);

// ── MCP Visibility & Compliance ───────────────────────

export const mcpStatusEnum = pgEnum("mcp_status", [
  "pending",
  "approved",
  "flagged",
  "blocked",
]);

export const mcpTransportEnum = pgEnum("mcp_transport", [
  "http",
  "sse",
  "stdio",
]);

export const mcpAlertTypeEnum = pgEnum("mcp_alert_type", [
  "new_mcp_discovered",
  "blocked_mcp_usage",
  "error_rate_spike",
  "mcp_in_new_repo",
]);

export const mcpAlertSeverityEnum = pgEnum("mcp_alert_severity", [
  "info",
  "low",
  "medium",
  "high",
]);

export const workspace_mcps = pgTable(
  "workspace_mcps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    canonical_id: text("canonical_id").notNull(),
    transport: mcpTransportEnum("transport").notNull(),
    display_name: text("display_name"),
    description: text("description"),
    status: mcpStatusEnum("status").notNull().default("pending"),
    setup_guidance: text("setup_guidance"),
    status_note: text("status_note"),
    status_changed_by: text("status_changed_by"),
    status_changed_at: timestamp("status_changed_at", {
      mode: "string",
      withTimezone: true,
    }),
    first_seen_at: timestamp("first_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_seen_at: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_mcps_workspace_canonical_idx").on(
      table.workspace_id,
      table.canonical_id
    ),
    index("workspace_mcps_workspace_id_idx").on(table.workspace_id),
    index("workspace_mcps_workspace_status_idx").on(
      table.workspace_id,
      table.status
    ),
  ]
);

export const mcp_aliases = pgTable(
  "mcp_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_mcp_id: uuid("workspace_mcp_id")
      .notNull()
      .references(() => workspace_mcps.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("mcp_aliases_mcp_alias_idx").on(
      table.workspace_mcp_id,
      table.alias
    ),
    index("mcp_aliases_alias_idx").on(table.alias),
  ]
);

export const mcp_tools = pgTable(
  "mcp_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_mcp_id: uuid("workspace_mcp_id")
      .notNull()
      .references(() => workspace_mcps.id, { onDelete: "cascade" }),
    tool_name: text("tool_name").notNull(),
    call_count: integer("call_count").notNull().default(0),
    error_count: integer("error_count").notNull().default(0),
    first_seen_at: timestamp("first_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    last_seen_at: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("mcp_tools_mcp_tool_idx").on(
      table.workspace_mcp_id,
      table.tool_name
    ),
  ]
);

export const mcp_usage = pgTable(
  "mcp_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workspace_mcp_id: uuid("workspace_mcp_id")
      .notNull()
      .references(() => workspace_mcps.id, { onDelete: "cascade" }),
    mcp_tool_id: uuid("mcp_tool_id").references(() => mcp_tools.id),
    run_id: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    event_id: uuid("event_id").references(() => events.id),
    repo_id: uuid("repo_id").references(() => repos.id),
    developer_entity_id: uuid("developer_entity_id").references(
      () => developers.id
    ),
    tool_name: text("tool_name").notNull(),
    is_error: boolean("is_error").notNull().default(false),
    occurred_at: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("mcp_usage_workspace_mcp_id_occurred_at_idx").on(
      table.workspace_mcp_id,
      table.occurred_at
    ),
    index("mcp_usage_workspace_id_occurred_at_idx").on(
      table.workspace_id,
      table.occurred_at
    ),
    index("mcp_usage_run_id_idx").on(table.run_id),
  ]
);

export const mcp_alerts = pgTable(
  "mcp_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workspace_mcp_id: uuid("workspace_mcp_id").references(
      () => workspace_mcps.id,
      { onDelete: "cascade" }
    ),
    alert_type: mcpAlertTypeEnum("alert_type").notNull(),
    severity: mcpAlertSeverityEnum("severity").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledged_by: text("acknowledged_by"),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("mcp_alerts_workspace_id_ack_created_idx").on(
      table.workspace_id,
      table.acknowledged,
      table.created_at
    ),
    index("mcp_alerts_workspace_mcp_id_idx").on(table.workspace_mcp_id),
  ]
);

export const api_keys = pgTable("api_keys", {
  id: uuid("id").primaryKey(),
  key_hash: text("key_hash").notNull().unique(),
  developer_id: text("developer_id").notNull(),
  developer_name: text("developer_name").notNull(),
  user_id: uuid("user_id").references(() => users.id),
  created_at: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
});

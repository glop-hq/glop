import {
  pgTable,
  pgEnum,
  text,
  integer,
  index,
  uuid,
  timestamp,
  jsonb,
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
  "artifact.added",
  "artifact.updated",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "pr",
  "preview",
  "ci",
  "commit",
]);

// ── Tables ─────────────────────────────────────────────

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey(),
    team_id: text("team_id").notNull(),
    developer_id: text("developer_id").notNull(),
    machine_id: text("machine_id").notNull(),
    repo_key: text("repo_key").notNull(),
    branch_name: text("branch_name").notNull(),
    session_id: text("session_id"),
    slug: text("slug"),
    status: runStatusEnum("status").notNull().default("active"),
    phase: runPhaseEnum("phase").notNull().default("unknown"),
    activity_kind: activityKindEnum("activity_kind").notNull().default("unknown"),
    git_user_name: text("git_user_name"),
    git_user_email: text("git_user_email"),
    title: text("title"),
    summary: text("summary"),
    current_action: text("current_action"),
    last_action_label: text("last_action_label"),
    file_count: integer("file_count").notNull().default(0),
    files_touched: jsonb("files_touched").$type<string[]>().notNull().default([]),
    started_at: timestamp("started_at", { mode: "string", withTimezone: true }).notNull(),
    last_heartbeat_at: timestamp("last_heartbeat_at", { mode: "string", withTimezone: true }).notNull(),
    last_event_at: timestamp("last_event_at", { mode: "string", withTimezone: true }).notNull(),
    completed_at: timestamp("completed_at", { mode: "string", withTimezone: true }),
    event_count: integer("event_count").notNull().default(0),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
    updated_at: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
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
  ]
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey(),
    event_type: eventTypeEnum("event_type").notNull(),
    occurred_at: timestamp("occurred_at", { mode: "string", withTimezone: true }).notNull(),
    received_at: timestamp("received_at", { mode: "string", withTimezone: true }).notNull(),
    run_id: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    developer_id: text("developer_id").notNull(),
    machine_id: text("machine_id").notNull(),
    repo_key: text("repo_key").notNull(),
    branch_name: text("branch_name").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
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
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    created_at: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  },
  (table) => [index("artifacts_run_id_idx").on(table.run_id)]
);

export const api_keys = pgTable("api_keys", {
  id: uuid("id").primaryKey(),
  key_hash: text("key_hash").notNull().unique(),
  developer_id: text("developer_id").notNull(),
  developer_name: text("developer_name").notNull(),
  created_at: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});

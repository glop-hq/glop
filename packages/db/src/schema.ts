import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    team_id: text("team_id").notNull(),
    developer_id: text("developer_id").notNull(),
    machine_id: text("machine_id").notNull(),
    repo_key: text("repo_key").notNull(),
    branch_name: text("branch_name").notNull(),
    session_id: text("session_id"),
    status: text("status").notNull().default("active"),
    phase: text("phase").notNull().default("unknown"),
    activity_kind: text("activity_kind").notNull().default("unknown"),
    title: text("title"),
    summary: text("summary"),
    current_action: text("current_action"),
    last_action_label: text("last_action_label"),
    file_count: integer("file_count").notNull().default(0),
    files_touched_json: text("files_touched_json").notNull().default("[]"),
    started_at: text("started_at").notNull(),
    last_heartbeat_at: text("last_heartbeat_at").notNull(),
    last_event_at: text("last_event_at").notNull(),
    completed_at: text("completed_at"),
    event_count: integer("event_count").notNull().default(0),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
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
  ]
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    event_type: text("event_type").notNull(),
    occurred_at: text("occurred_at").notNull(),
    received_at: text("received_at").notNull(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    developer_id: text("developer_id").notNull(),
    machine_id: text("machine_id").notNull(),
    repo_key: text("repo_key").notNull(),
    branch_name: text("branch_name").notNull(),
    payload: text("payload").notNull().default("{}"),
  },
  (table) => [
    index("events_run_id_idx").on(table.run_id),
    index("events_occurred_at_idx").on(table.occurred_at),
  ]
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    run_id: text("run_id")
      .notNull()
      .references(() => runs.id),
    artifact_type: text("artifact_type").notNull(),
    url: text("url"),
    label: text("label"),
    external_id: text("external_id"),
    state: text("state"),
    metadata: text("metadata").notNull().default("{}"),
    created_at: text("created_at").notNull(),
  },
  (table) => [index("artifacts_run_id_idx").on(table.run_id)]
);

export const api_keys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  key_hash: text("key_hash").notNull().unique(),
  developer_id: text("developer_id").notNull(),
  developer_name: text("developer_name").notNull(),
  created_at: text("created_at").notNull(),
});

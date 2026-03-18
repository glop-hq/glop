import pg from "pg";
import { createDb, schema } from "@glop/db";
import { createHash, randomBytes } from "crypto";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://localhost:5432/glop",
});
const db = createDb(pool);

function id() {
  return crypto.randomUUID();
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function seed() {
  console.log("Seeding database...");

  // Create a demo workspace
  const workspaceId = id();
  await db.insert(schema.workspaces).values({
    id: workspaceId,
    name: "Acme Corp",
    slug: "acme",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Create API keys for demo devs
  const devs = [
    { name: "Alice", id: id() },
    { name: "Bob", id: id() },
    { name: "Carol", id: id() },
  ];

  const apiKeys: string[] = [];
  for (const dev of devs) {
    const apiKey = `glop_${randomBytes(24).toString("hex")}`;
    apiKeys.push(apiKey);
    await db.insert(schema.api_keys).values({
      id: id(),
      key_hash: hashKey(apiKey),
      developer_id: dev.id,
      developer_name: dev.name,
      created_at: new Date().toISOString(),
    });
  }

  const machineIds = [id(), id(), id()];

  // Run 1: Alice - active, editing
  const run1Id = id();
  await db.insert(schema.runs).values({
    id: run1Id,
    workspace_id: workspaceId,
    developer_id: devs[0].id,
    machine_id: machineIds[0],
    repo_key: "acme/frontend",
    branch_name: "feat/auth-flow",
    status: "active",
    phase: "editing",
    activity_kind: "editing",
    title: "Alice working on acme/frontend",
    current_action: "Editing auth-provider.tsx",
    last_action_label: "Editing auth-provider.tsx",
    file_count: 5,
    started_at: ago(25),
    last_heartbeat_at: ago(0.5),
    last_event_at: ago(0.5),
    event_count: 42,
    created_at: ago(25),
    updated_at: ago(0.5),
  });

  // Events for run 1
  const run1Events = [
    { type: "run.started" as const, at: ago(25), payload: { action_label: "Started" } },
    { type: "run.heartbeat" as const, at: ago(20), payload: { tool_name: "Read", action_label: "Reading package.json", activity_kind: "reading" } },
    { type: "run.heartbeat" as const, at: ago(15), payload: { tool_name: "Glob", action_label: "Searching for auth files", activity_kind: "reading" } },
    { type: "run.heartbeat" as const, at: ago(10), payload: { tool_name: "Edit", action_label: "Editing auth-provider.tsx", activity_kind: "editing" } },
    { type: "run.heartbeat" as const, at: ago(5), payload: { tool_name: "Write", action_label: "Creating useAuth.ts", activity_kind: "editing" } },
    { type: "run.heartbeat" as const, at: ago(2), payload: { tool_name: "Bash", action_label: "Running tests", activity_kind: "test_run" } },
    { type: "run.heartbeat" as const, at: ago(0.5), payload: { tool_name: "Edit", action_label: "Editing auth-provider.tsx", activity_kind: "editing" } },
  ];

  for (const evt of run1Events) {
    await db.insert(schema.events).values({
      id: id(),
      event_type: evt.type,
      occurred_at: evt.at,
      received_at: evt.at,
      run_id: run1Id,
      developer_id: devs[0].id,
      machine_id: machineIds[0],
      repo_key: "acme/frontend",
      branch_name: "feat/auth-flow",
      payload: evt.payload,
    });
  }

  // Run 2: Bob - active, validating (running tests)
  const run2Id = id();
  await db.insert(schema.runs).values({
    id: run2Id,
    workspace_id: workspaceId,
    developer_id: devs[1].id,
    machine_id: machineIds[1],
    repo_key: "acme/api",
    branch_name: "fix/rate-limiter",
    status: "active",
    phase: "validating",
    activity_kind: "test_run",
    title: "Bob working on acme/api",
    current_action: "Running tests",
    last_action_label: "Running tests",
    file_count: 3,
    started_at: ago(12),
    last_heartbeat_at: ago(1),
    last_event_at: ago(1),
    event_count: 18,
    created_at: ago(12),
    updated_at: ago(1),
  });

  const run2Events = [
    { type: "run.started" as const, at: ago(12), payload: { action_label: "Started" } },
    { type: "run.heartbeat" as const, at: ago(8), payload: { tool_name: "Read", action_label: "Reading rate-limiter.ts", activity_kind: "reading" } },
    { type: "run.heartbeat" as const, at: ago(5), payload: { tool_name: "Edit", action_label: "Editing rate-limiter.ts", activity_kind: "editing" } },
    { type: "run.heartbeat" as const, at: ago(1), payload: { tool_name: "Bash", action_label: "Running tests", activity_kind: "test_run" } },
  ];

  for (const evt of run2Events) {
    await db.insert(schema.events).values({
      id: id(),
      event_type: evt.type,
      occurred_at: evt.at,
      received_at: evt.at,
      run_id: run2Id,
      developer_id: devs[1].id,
      machine_id: machineIds[1],
      repo_key: "acme/api",
      branch_name: "fix/rate-limiter",
      payload: evt.payload,
    });
  }

  // Run 3: Carol - stale
  const run3Id = id();
  await db.insert(schema.runs).values({
    id: run3Id,
    workspace_id: workspaceId,
    developer_id: devs[2].id,
    machine_id: machineIds[2],
    repo_key: "acme/docs",
    branch_name: "update/api-docs",
    status: "stale",
    phase: "editing",
    activity_kind: "editing",
    title: "Carol working on acme/docs",
    current_action: "Editing api-reference.md",
    last_action_label: "Editing api-reference.md",
    file_count: 2,
    started_at: ago(45),
    last_heartbeat_at: ago(8),
    last_event_at: ago(8),
    event_count: 11,
    created_at: ago(45),
    updated_at: ago(8),
  });

  // Run 4: Alice's previous run - completed
  const run4Id = id();
  await db.insert(schema.runs).values({
    id: run4Id,
    workspace_id: workspaceId,
    developer_id: devs[0].id,
    machine_id: machineIds[0],
    repo_key: "acme/frontend",
    branch_name: "fix/button-styles",
    status: "completed",
    phase: "done",
    activity_kind: "unknown",
    title: "Alice working on acme/frontend",
    file_count: 4,
    started_at: ago(120),
    last_heartbeat_at: ago(90),
    last_event_at: ago(90),
    completed_at: ago(90),
    event_count: 28,
    created_at: ago(120),
    updated_at: ago(90),
  });

  // Run 5: Bob's previous run - failed
  const run5Id = id();
  await db.insert(schema.runs).values({
    id: run5Id,
    workspace_id: workspaceId,
    developer_id: devs[1].id,
    machine_id: machineIds[1],
    repo_key: "acme/api",
    branch_name: "feat/webhooks",
    status: "failed",
    phase: "failed",
    activity_kind: "unknown",
    title: "Bob working on acme/api",
    file_count: 7,
    started_at: ago(180),
    last_heartbeat_at: ago(160),
    last_event_at: ago(160),
    completed_at: ago(160),
    event_count: 35,
    created_at: ago(180),
    updated_at: ago(160),
  });

  // Add an artifact to run 4
  await db.insert(schema.artifacts).values({
    id: id(),
    run_id: run4Id,
    artifact_type: "pr",
    url: "https://github.com/acme/frontend/pull/42",
    label: "PR #42",
    external_id: "42",
    state: "merged",
    metadata: {},
    created_at: ago(95),
  });

  console.log("Seeded:");
  console.log("  1 workspace (Acme Corp)");
  console.log("  3 developers with API keys");
  console.log("  5 runs (2 active, 1 stale, 1 completed, 1 failed)");
  console.log("  Events and artifacts");
  console.log(`\nDemo API keys (for testing):`);
  devs.forEach((dev, i) => {
    console.log(`  ${dev.name}: ${apiKeys[i]}`);
  });

  await pool.end();
}

seed().catch(console.error);

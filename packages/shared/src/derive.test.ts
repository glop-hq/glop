import { describe, it, expect } from "vitest";
import {
  deriveRunPatch,
  deriveTimeBasedStatus,
  shouldCreateNewRun,
} from "./derive";
import type { Run } from "./types/runs";
import { STALE_THRESHOLD_MS, AUTO_CLOSE_THRESHOLD_MS } from "./constants";

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    workspace_id: "ws-1",
    owner_user_id: null,
    developer_id: "dev-1",
    machine_id: "machine-1",
    repo_key: "org/repo",
    branch_name: "main",
    session_id: null,
    status: "active",
    phase: "editing",
    activity_kind: "editing",
    git_user_name: null,
    git_user_email: null,
    title: null,
    summary: null,
    current_action: null,
    last_action_label: null,
    file_count: 0,
    files_touched: [],
    visibility: "private",
    shared_link_state: null,
    shared_link_expires_at: null,
    share_created_at: null,
    started_at: "2025-01-01T00:00:00Z",
    last_heartbeat_at: "2025-01-01T00:10:00Z",
    last_event_at: "2025-01-01T00:10:00Z",
    completed_at: null,
    event_count: 5,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:10:00Z",
    ...overrides,
  };
}

describe("deriveRunPatch", () => {
  const now = "2025-01-01T00:15:00Z";

  it("sets active status on run.started", () => {
    const run = makeRun({ status: "stale" });
    const patch = deriveRunPatch(run, "run.started", null, now);
    expect(patch.status).toBe("active");
    expect(patch.phase).toBe("unknown");
    expect(patch.event_count).toBe(6);
    expect(patch.last_event_at).toBe(now);
  });

  it("reactivates stale run on heartbeat", () => {
    const run = makeRun({ status: "stale" });
    const patch = deriveRunPatch(run, "run.heartbeat", null, now);
    expect(patch.status).toBe("active");
    expect(patch.completed_at).toBeNull();
  });

  it("reactivates completed run on heartbeat", () => {
    const run = makeRun({
      status: "completed",
      completed_at: "2025-01-01T00:12:00Z",
    });
    const patch = deriveRunPatch(run, "run.heartbeat", null, now);
    expect(patch.status).toBe("active");
    expect(patch.completed_at).toBeNull();
  });

  it("reactivates failed run on heartbeat", () => {
    const run = makeRun({
      status: "failed",
      completed_at: "2025-01-01T00:12:00Z",
    });
    const patch = deriveRunPatch(run, "run.heartbeat", null, now);
    expect(patch.status).toBe("active");
    expect(patch.completed_at).toBeNull();
  });

  it("does not change status for active run on heartbeat", () => {
    const run = makeRun({ status: "active" });
    const patch = deriveRunPatch(run, "run.heartbeat", null, now);
    expect(patch.status).toBeUndefined();
  });

  it("applies activity from heartbeat", () => {
    const run = makeRun();
    const activity = {
      activity_kind: "test_run" as const,
      phase: "validating" as const,
      action_label: "Running tests",
      files_touched: ["src/test.ts"],
    };
    const patch = deriveRunPatch(run, "run.heartbeat", activity, now);
    expect(patch.activity_kind).toBe("test_run");
    expect(patch.phase).toBe("validating");
    expect(patch.current_action).toBe("Running tests");
    expect(patch.files_touched).toEqual(["src/test.ts"]);
    expect(patch.file_count).toBe(1);
  });

  it("merges files_touched from heartbeat activity", () => {
    const run = makeRun({ files_touched: ["a.ts"], file_count: 1 });
    const activity = {
      activity_kind: "editing" as const,
      phase: "editing" as const,
      action_label: "Editing b.ts",
      files_touched: ["b.ts"],
    };
    const patch = deriveRunPatch(run, "run.heartbeat", activity, now);
    expect(patch.files_touched).toEqual(expect.arrayContaining(["a.ts", "b.ts"]));
    expect(patch.file_count).toBe(2);
  });

  it("deduplicates files_touched", () => {
    const run = makeRun({ files_touched: ["a.ts"], file_count: 1 });
    const activity = {
      activity_kind: "editing" as const,
      phase: "editing" as const,
      action_label: "Editing a.ts",
      files_touched: ["a.ts"],
    };
    const patch = deriveRunPatch(run, "run.heartbeat", activity, now);
    expect(patch.files_touched).toEqual(["a.ts"]);
    expect(patch.file_count).toBe(1);
  });

  it("updates phase on phase_changed", () => {
    const run = makeRun();
    const activity = {
      activity_kind: "test_run" as const,
      phase: "validating" as const,
      action_label: "Running tests",
      files_touched: [],
    };
    const patch = deriveRunPatch(run, "run.phase_changed", activity, now);
    expect(patch.phase).toBe("validating");
    expect(patch.activity_kind).toBe("test_run");
    expect(patch.status).toBeUndefined();
  });

  it("marks run completed on run.completed", () => {
    const run = makeRun();
    const patch = deriveRunPatch(run, "run.completed", null, now);
    expect(patch.status).toBe("completed");
    expect(patch.phase).toBe("done");
    expect(patch.completed_at).toBe(now);
    expect(patch.current_action).toBeNull();
  });

  it("marks run failed on run.failed", () => {
    const run = makeRun();
    const patch = deriveRunPatch(run, "run.failed", null, now);
    expect(patch.status).toBe("failed");
    expect(patch.phase).toBe("failed");
    expect(patch.completed_at).toBe(now);
    expect(patch.current_action).toBeNull();
  });

  it("does not change status on title_updated", () => {
    const run = makeRun();
    const patch = deriveRunPatch(run, "run.title_updated", null, now);
    expect(patch.status).toBeUndefined();
    expect(patch.phase).toBeUndefined();
  });

  it("does not change status on artifact.added", () => {
    const run = makeRun();
    const patch = deriveRunPatch(run, "artifact.added", null, now);
    expect(patch.status).toBeUndefined();
    expect(patch.phase).toBeUndefined();
  });

  it("always increments event_count", () => {
    const run = makeRun({ event_count: 10 });
    const patch = deriveRunPatch(run, "run.heartbeat", null, now);
    expect(patch.event_count).toBe(11);
  });
});

describe("deriveTimeBasedStatus", () => {
  it("returns null for completed runs", () => {
    const run = makeRun({ status: "completed" });
    const result = deriveTimeBasedStatus(run, new Date());
    expect(result).toBeNull();
  });

  it("returns null for failed runs", () => {
    const run = makeRun({ status: "failed" });
    const result = deriveTimeBasedStatus(run, new Date());
    expect(result).toBeNull();
  });

  it("returns null when run is fresh", () => {
    const now = new Date();
    const run = makeRun({
      last_heartbeat_at: new Date(now.getTime() - 1000).toISOString(),
    });
    const result = deriveTimeBasedStatus(run, now);
    expect(result).toBeNull();
  });

  it("marks stale after STALE_THRESHOLD_MS", () => {
    const now = new Date();
    const run = makeRun({
      status: "active",
      last_heartbeat_at: new Date(
        now.getTime() - STALE_THRESHOLD_MS - 1000
      ).toISOString(),
    });
    const result = deriveTimeBasedStatus(run, now);
    expect(result).toEqual({ status: "stale" });
  });

  it("does not re-mark already stale run", () => {
    const now = new Date();
    const run = makeRun({
      status: "stale",
      last_heartbeat_at: new Date(
        now.getTime() - STALE_THRESHOLD_MS - 1000
      ).toISOString(),
    });
    const result = deriveTimeBasedStatus(run, now);
    expect(result).toBeNull();
  });

  it("auto-closes after AUTO_CLOSE_THRESHOLD_MS", () => {
    const now = new Date();
    const run = makeRun({
      status: "stale",
      last_heartbeat_at: new Date(
        now.getTime() - AUTO_CLOSE_THRESHOLD_MS - 1000
      ).toISOString(),
    });
    const result = deriveTimeBasedStatus(run, now);
    expect(result?.status).toBe("completed");
    expect(result?.completed_at).toBeDefined();
  });

  it("auto-closes active run that exceeded AUTO_CLOSE threshold", () => {
    const now = new Date();
    const run = makeRun({
      status: "active",
      last_heartbeat_at: new Date(
        now.getTime() - AUTO_CLOSE_THRESHOLD_MS - 1000
      ).toISOString(),
    });
    const result = deriveTimeBasedStatus(run, now);
    expect(result?.status).toBe("completed");
  });
});

describe("shouldCreateNewRun", () => {
  it("returns true when no existing run", () => {
    expect(shouldCreateNewRun(null)).toBe(true);
  });

  it("returns false for active run", () => {
    const run = makeRun({ status: "active" });
    expect(shouldCreateNewRun(run)).toBe(false);
  });

  it("returns false for stale run", () => {
    const run = makeRun({ status: "stale" });
    expect(shouldCreateNewRun(run)).toBe(false);
  });

  it("returns false for blocked run", () => {
    const run = makeRun({ status: "blocked" });
    expect(shouldCreateNewRun(run)).toBe(false);
  });

  it("returns true for completed run (no session match)", () => {
    const run = makeRun({ status: "completed" });
    expect(shouldCreateNewRun(run, false)).toBe(true);
  });

  it("returns true for failed run (no session match)", () => {
    const run = makeRun({ status: "failed" });
    expect(shouldCreateNewRun(run, false)).toBe(true);
  });

  it("returns false for completed run when matched by session_id", () => {
    const run = makeRun({ status: "completed" });
    expect(shouldCreateNewRun(run, true)).toBe(false);
  });

  it("returns false for failed run when matched by session_id", () => {
    const run = makeRun({ status: "failed" });
    expect(shouldCreateNewRun(run, true)).toBe(false);
  });
});

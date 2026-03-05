import { describe, it, expect } from "vitest";
import {
  authRegisterSchema,
  historyQuerySchema,
  runVisibilitySchema,
  memberRoleSchema,
  workspaceCreateSchema,
  workspaceUpdateSchema,
  memberInviteSchema,
  shareRunSchema,
  hookTypeSchema,
  rawHookPayloadSchema,
  ingestEventSchema,
} from "./validation";

describe("authRegisterSchema", () => {
  it("accepts valid developer name", () => {
    const result = authRegisterSchema.safeParse({ developer_name: "Alice" });
    expect(result.success).toBe(true);
  });

  it("rejects empty developer name", () => {
    const result = authRegisterSchema.safeParse({ developer_name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = authRegisterSchema.safeParse({
      developer_name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing developer_name", () => {
    const result = authRegisterSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("historyQuerySchema", () => {
  it("uses defaults when empty", () => {
    const result = historyQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ offset: 0, limit: 50, scope: "all" });
  });

  it("coerces string numbers", () => {
    const result = historyQuerySchema.safeParse({ offset: "10", limit: "25" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ offset: 10, limit: 25, scope: "all" });
  });

  it("rejects negative offset", () => {
    const result = historyQuerySchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects limit over 100", () => {
    const result = historyQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects limit of 0", () => {
    const result = historyQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });
});

describe("runVisibilitySchema", () => {
  it.each(["private", "workspace", "shared_link"])("accepts %s", (val) => {
    expect(runVisibilitySchema.safeParse(val).success).toBe(true);
  });

  it("rejects invalid value", () => {
    expect(runVisibilitySchema.safeParse("public").success).toBe(false);
  });
});

describe("memberRoleSchema", () => {
  it.each(["admin", "member"])("accepts %s", (val) => {
    expect(memberRoleSchema.safeParse(val).success).toBe(true);
  });

  it("rejects invalid value", () => {
    expect(memberRoleSchema.safeParse("owner").success).toBe(false);
  });
});

describe("workspaceCreateSchema", () => {
  it("accepts valid workspace", () => {
    const result = workspaceCreateSchema.safeParse({
      name: "My Workspace",
      slug: "my-workspace",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = workspaceCreateSchema.safeParse({
      name: "",
      slug: "my-workspace",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase", () => {
    const result = workspaceCreateSchema.safeParse({
      name: "Test",
      slug: "My-Workspace",
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = workspaceCreateSchema.safeParse({
      name: "Test",
      slug: "my workspace",
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug with numbers and hyphens", () => {
    const result = workspaceCreateSchema.safeParse({
      name: "Test",
      slug: "team-42",
    });
    expect(result.success).toBe(true);
  });
});

describe("workspaceUpdateSchema", () => {
  it("accepts optional name", () => {
    const result = workspaceUpdateSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = workspaceUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("memberInviteSchema", () => {
  it("accepts valid invite", () => {
    const result = memberInviteSchema.safeParse({
      email: "user@example.com",
      role: "admin",
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to member", () => {
    const result = memberInviteSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe("member");
  });

  it("rejects invalid email", () => {
    const result = memberInviteSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("shareRunSchema", () => {
  it("accepts valid share action with expires_in_days", () => {
    const result = shareRunSchema.safeParse({
      action: "create_link",
      expires_in_days: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts action without expires_in_days", () => {
    const result = shareRunSchema.safeParse({ action: "share_workspace" });
    expect(result.success).toBe(true);
  });

  it("accepts all valid actions", () => {
    for (const action of ["share_workspace", "unshare_workspace", "create_link", "revoke_link"]) {
      const result = shareRunSchema.safeParse({ action });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid action", () => {
    const result = shareRunSchema.safeParse({ action: "delete" });
    expect(result.success).toBe(false);
  });

  it("rejects expires_in_days over 365", () => {
    const result = shareRunSchema.safeParse({
      action: "create_link",
      expires_in_days: 366,
    });
    expect(result.success).toBe(false);
  });

  it("rejects expires_in_days of 0", () => {
    const result = shareRunSchema.safeParse({
      action: "create_link",
      expires_in_days: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("hookTypeSchema", () => {
  it.each([
    "PostToolUse",
    "PreToolUse",
    "PermissionRequest",
    "Stop",
    "UserPromptSubmit",
    "SessionStart",
    "SessionEnd",
  ])("accepts %s", (val) => {
    expect(hookTypeSchema.safeParse(val).success).toBe(true);
  });

  it("rejects invalid hook type", () => {
    expect(hookTypeSchema.safeParse("Unknown").success).toBe(false);
  });
});

describe("rawHookPayloadSchema", () => {
  it("accepts minimal payload", () => {
    const result = rawHookPayloadSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts full payload", () => {
    const result = rawHookPayloadSchema.safeParse({
      hook_type: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: "/src/main.ts" },
      session_id: "abc-123",
      cwd: "/home/user/project",
    });
    expect(result.success).toBe(true);
  });

  it("passes through extra fields", () => {
    const result = rawHookPayloadSchema.safeParse({
      custom_field: "value",
    });
    expect(result.success).toBe(true);
    expect(result.data?.custom_field).toBe("value");
  });
});

describe("ingestEventSchema", () => {
  it("accepts valid event", () => {
    const result = ingestEventSchema.safeParse({
      event_type: "run.heartbeat",
      repo_key: "org/repo",
      branch_name: "main",
    });
    expect(result.success).toBe(true);
    expect(result.data?.payload).toEqual({});
  });

  it("accepts event with payload", () => {
    const result = ingestEventSchema.safeParse({
      event_type: "run.started",
      repo_key: "org/repo",
      branch_name: "main",
      payload: { tool_name: "Edit" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid event_type", () => {
    const result = ingestEventSchema.safeParse({
      event_type: "invalid",
      repo_key: "org/repo",
      branch_name: "main",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing repo_key", () => {
    const result = ingestEventSchema.safeParse({
      event_type: "run.heartbeat",
      branch_name: "main",
    });
    expect(result.success).toBe(false);
  });
});

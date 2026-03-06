import { describe, it, expect } from "vitest";
import { classifyHookPayload } from "./hook-classifier";

describe("classifyHookPayload", () => {
  describe("hook types", () => {
    it("classifies UserPromptSubmit", () => {
      const result = classifyHookPayload("UserPromptSubmit", {
        prompt: "Fix the login bug",
      });
      expect(result.content_type).toBe("prompt");
      expect(result.activity_kind).toBe("editing");
      expect(result.phase).toBe("waiting");
      expect(result.content).toBe("Fix the login bug");
      expect(result.is_completion).toBe(false);
    });

    it("classifies SessionStart", () => {
      const result = classifyHookPayload("SessionStart", {});
      expect(result.content_type).toBe("session_start");
      expect(result.is_session_start).toBe(true);
      expect(result.is_completion).toBe(false);
    });

    it("classifies SessionEnd", () => {
      const result = classifyHookPayload("SessionEnd", {});
      expect(result.content_type).toBe("session_end");
      expect(result.is_completion).toBe(true);
      expect(result.phase).toBe("done");
    });

    it("classifies PermissionRequest", () => {
      const result = classifyHookPayload("PermissionRequest", {
        tool_name: "Bash",
        tool_input: { command: "npm test", description: "Run tests" },
      });
      expect(result.content_type).toBe("permission_request");
      expect(result.activity_kind).toBe("waiting");
      expect(result.phase).toBe("waiting");
      expect(result.action_label).toContain("Waiting for approval");
    });

    it("classifies Stop", () => {
      const result = classifyHookPayload("Stop", {
        last_assistant_message: "Done!",
      });
      expect(result.content_type).toBe("response");
      expect(result.activity_kind).toBe("waiting");
      expect(result.content).toBe("Done!");
    });
  });

  describe("PostToolUse - edit tools", () => {
    it.each(["Write", "Edit", "NotebookEdit"])("classifies %s as editing", (tool) => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: tool,
        tool_input: { file_path: "/src/main.ts" },
      });
      expect(result.activity_kind).toBe("editing");
      expect(result.phase).toBe("editing");
      expect(result.files_touched).toEqual(["/src/main.ts"]);
    });
  });

  describe("PostToolUse - read tools", () => {
    it.each(["Read", "Glob", "Grep"])("classifies %s as reading", (tool) => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: tool,
        tool_input: { file_path: "/src/main.ts" },
      });
      expect(result.activity_kind).toBe("reading");
      expect(result.phase).toBe("editing");
    });
  });

  describe("PostToolUse - Bash command classification", () => {
    it("classifies test commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "pnpm test" },
      });
      expect(result.activity_kind).toBe("test_run");
      expect(result.phase).toBe("validating");
    });

    it("classifies build commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "next build" },
      });
      expect(result.activity_kind).toBe("build_run");
      expect(result.phase).toBe("validating");
    });

    it("classifies lint commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "eslint src/" },
      });
      expect(result.activity_kind).toBe("check_run");
      expect(result.phase).toBe("validating");
    });

    it("classifies git commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "git commit -m 'fix'" },
      });
      expect(result.activity_kind).toBe("git_action");
    });

    it("classifies install commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "pnpm add lodash" },
      });
      expect(result.activity_kind).toBe("install_deps");
    });

    it("classifies docker commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "docker run nginx" },
      });
      expect(result.activity_kind).toBe("docker_action");
    });

    it("classifies deploy commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "vercel deploy" },
      });
      expect(result.activity_kind).toBe("deploy_action");
    });

    it("falls back to unknown for unrecognized commands", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "echo hello" },
      });
      expect(result.activity_kind).toBe("unknown");
    });
  });

  describe("PostToolUse - special tools", () => {
    it("classifies WebFetch", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "WebFetch",
        tool_input: { url: "https://example.com" },
      });
      expect(result.activity_kind).toBe("web_fetch");
    });

    it("classifies WebSearch", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "WebSearch",
        tool_input: { query: "vitest config" },
      });
      expect(result.activity_kind).toBe("web_search");
    });

    it("classifies AskUserQuestion", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "AskUserQuestion",
        tool_input: {},
      });
      expect(result.activity_kind).toBe("ask_user");
      expect(result.phase).toBe("waiting");
    });

    it("classifies Task (subagent)", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Task",
        tool_input: {
          subagent_type: "Explore",
          description: "Find auth files",
        },
      });
      expect(result.activity_kind).toBe("editing");
      expect(result.action_label).toContain("Explore");
      expect(result.action_label).toContain("Find auth files");
    });

    it("classifies todo tools", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "TodoWrite",
        tool_input: {},
      });
      expect(result.activity_kind).toBe("todo_action");
    });

    it("classifies plan mode tools", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "EnterPlanMode",
        tool_input: {},
      });
      expect(result.activity_kind).toBe("plan_mode");
    });

    it("classifies Skill", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Skill",
        tool_input: { skill: "commit" },
      });
      expect(result.activity_kind).toBe("skill_invoke");
      expect(result.action_label).toContain("commit");
    });
  });

  describe("PostToolUse - unknown tools", () => {
    it("defaults to unknown for unrecognized tools", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "CustomMcpTool",
        tool_input: {},
      });
      expect(result.activity_kind).toBe("unknown");
      expect(result.action_label).toBe("CustomMcpTool");
    });
  });

  describe("file extraction", () => {
    it("extracts file_path from tool_input", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Write",
        tool_input: { file_path: "/src/index.ts" },
      });
      expect(result.files_touched).toEqual(["/src/index.ts"]);
    });

    it("does not track files for read tools", () => {
      const result = classifyHookPayload("PostToolUse", {
        tool_name: "Read",
        tool_input: { path: "/src/config.ts" },
      });
      expect(result.files_touched).toEqual([]);
    });
  });
});

import type { ActivityKind, RunPhase, RawHookPayload } from "@glop/shared";

export type ContentType = "prompt" | "response" | "tool_use" | "permission_request" | "session_start" | "session_end" | "context_compacted" | "heartbeat";

export interface ClassifiedHook {
  activity_kind: ActivityKind;
  phase: RunPhase;
  action_label: string;
  files_touched: string[];
  is_completion: boolean;
  is_session_start: boolean;
  content_type: ContentType;
  content?: string;
}

const EDIT_TOOLS = new Set(["Write", "Edit", "NotebookEdit"]);
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const GIT_TOOLS = new Set(["git"]);
const WEB_TOOLS = new Set(["WebFetch"]);
const SEARCH_TOOLS = new Set(["WebSearch"]);
const TODO_TOOLS = new Set(["TodoRead", "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet"]);
const PLAN_TOOLS = new Set(["EnterPlanMode", "ExitPlanMode"]);

const TEST_PATTERNS =
  /\b(test|jest|vitest|pytest|mocha|karma|cypress|playwright|spec|npm\s+test|pnpm\s+test|yarn\s+test)\b/i;
const BUILD_PATTERNS =
  /\b(build|compile|tsc|webpack|vite\s+build|rollup|esbuild|next\s+build|cargo\s+build|go\s+build|make)\b/i;
const GIT_PATTERNS = /\bgit\s+(commit|push|pull|merge|rebase|checkout|branch|stash|add|reset|diff|log|status)\b/i;
const CHECK_PATTERNS = /\b(lint|eslint|prettier|biome|fmt|check|clippy)\b/i;
const INSTALL_PATTERNS =
  /\b(npm\s+install|npm\s+i\b|pnpm\s+(add|install|i\b)|yarn\s+(add|install)|pip\s+install|cargo\s+add|go\s+get|brew\s+install|apt\s+install|apt-get\s+install)\b/i;
const DOCKER_PATTERNS =
  /\b(docker|docker-compose|podman)\b/i;
const DEPLOY_PATTERNS =
  /\b(deploy|publish|release|vercel|netlify|fly\s+deploy|railway)\b/i;

function extractFilesFromToolInput(
  toolName: string,
  toolInput: Record<string, unknown>
): string[] {
  const files: string[] = [];
  if (toolInput.file_path && typeof toolInput.file_path === "string") {
    files.push(toolInput.file_path);
  }
  if (toolInput.path && typeof toolInput.path === "string") {
    files.push(toolInput.path);
  }
  if (toolInput.paths && Array.isArray(toolInput.paths)) {
    for (const p of toolInput.paths) {
      if (typeof p === "string") files.push(p);
    }
  }
  return files;
}

function truncateStr(str: string, maxLen = 80): string {
  const firstLine = str.split("\n")[0].trim();
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + "..." : firstLine;
}

function classifyBashCommand(command: string): {
  activity_kind: ActivityKind;
  phase: RunPhase;
  label: string;
} {
  const shortCmd = truncateStr(command);
  if (TEST_PATTERNS.test(command)) {
    return { activity_kind: "test_run", phase: "validating", label: `Running tests: ${shortCmd}` };
  }
  if (BUILD_PATTERNS.test(command)) {
    return { activity_kind: "build_run", phase: "validating", label: `Building: ${shortCmd}` };
  }
  if (CHECK_PATTERNS.test(command)) {
    return { activity_kind: "check_run", phase: "validating", label: `Running checks: ${shortCmd}` };
  }
  if (GIT_PATTERNS.test(command)) {
    return { activity_kind: "git_action", phase: "editing", label: `Git: ${shortCmd}` };
  }
  if (INSTALL_PATTERNS.test(command)) {
    return { activity_kind: "install_deps", phase: "editing", label: `Installing: ${shortCmd}` };
  }
  if (DOCKER_PATTERNS.test(command)) {
    return { activity_kind: "docker_action", phase: "editing", label: `Docker: ${shortCmd}` };
  }
  if (DEPLOY_PATTERNS.test(command)) {
    return { activity_kind: "deploy_action", phase: "validating", label: `Deploying: ${shortCmd}` };
  }
  return { activity_kind: "unknown", phase: "editing", label: `$ ${shortCmd}` };
}

export function classifyHookPayload(
  hookType: string,
  payload: RawHookPayload
): ClassifiedHook {
  // UserPromptSubmit — developer typed something
  if (hookType === "UserPromptSubmit") {
    const prompt = typeof payload.prompt === "string" ? payload.prompt : undefined;

    // System-injected messages (e.g. background task killed on /exit) are not
    // real developer prompts — suppress them so they don't appear in the feed.
    if (prompt && /^\s*<task-notification[\s>]/i.test(prompt)) {
      return {
        activity_kind: "unknown",
        phase: "editing",
        action_label: "Task notification",
        files_touched: [],
        is_completion: false,
        is_session_start: false,
        content_type: "heartbeat",
      };
    }

    return {
      activity_kind: "editing",
      phase: "waiting",
      action_label: "Developer prompted",
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "prompt",
      content: prompt,
    };
  }

  // PreCompact — context compaction is about to happen
  if (hookType === "PreCompact") {
    const trigger =
      typeof payload.source === "string"
        ? payload.source
        : typeof payload.trigger === "string"
          ? payload.trigger
          : "unknown";
    return {
      activity_kind: "unknown",
      phase: "editing",
      action_label: `Context compacted (${trigger})`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "context_compacted",
      content: trigger,
    };
  }

  // SessionStart — session begins
  if (hookType === "SessionStart") {
    return {
      activity_kind: "unknown",
      phase: "unknown",
      action_label: "Session started",
      files_touched: [],
      is_completion: false,
      is_session_start: true,
      content_type: "session_start",
    };
  }

  // SessionEnd — session terminates
  if (hookType === "SessionEnd") {
    return {
      activity_kind: "unknown",
      phase: "done",
      action_label: "Session ended",
      files_touched: [],
      is_completion: true,
      is_session_start: false,
      content_type: "session_end",
    };
  }

  // PermissionRequest — Claude wants to use a tool, waiting for user approval
  if (hookType === "PermissionRequest") {
    const toolName = payload.tool_name || "";
    const toolInput = (payload.tool_input || {}) as Record<string, unknown>;
    const files = extractFilesFromToolInput(toolName, toolInput);

    let detail: string;
    if (toolName === "Bash") {
      const command = typeof toolInput.command === "string" ? toolInput.command : "";
      const description = typeof toolInput.description === "string" ? toolInput.description : "";
      detail = description || (command ? `$ ${truncateStr(command)}` : "command");
    } else {
      const fileLabel = files[0] ? files[0].split("/").pop() : "";
      detail = fileLabel || toolName;
    }

    return {
      activity_kind: "waiting",
      phase: "waiting",
      action_label: `Waiting for approval: ${detail}`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "permission_request",
      content: toolName,
    };
  }

  // Stop hook — Claude finished responding
  if (hookType === "Stop") {
    return {
      activity_kind: "waiting",
      phase: "waiting",
      action_label: "Claude responded",
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "response",
      content: typeof payload.last_assistant_message === "string"
        ? payload.last_assistant_message
        : undefined,
    };
  }

  // PostToolUse — tool was used
  const toolName = payload.tool_name || "";
  const toolInput = (payload.tool_input || {}) as Record<string, unknown>;
  const files = extractFilesFromToolInput(toolName, toolInput);

  // Edit/Write tools
  if (EDIT_TOOLS.has(toolName)) {
    return {
      activity_kind: "editing",
      phase: "editing",
      action_label: `Editing ${files[0] ? files[0].split("/").pop() : "file"}`,
      files_touched: files,
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Read tools
  if (READ_TOOLS.has(toolName)) {
    return {
      activity_kind: "reading",
      phase: "editing",
      action_label: `Reading ${files[0] ? files[0].split("/").pop() : "files"}`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Bash tool — classify by command content
  if (toolName === "Bash") {
    const command =
      typeof toolInput.command === "string" ? toolInput.command : "";
    const classified = classifyBashCommand(command);
    return {
      activity_kind: classified.activity_kind,
      phase: classified.phase,
      action_label: classified.label,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Task tool (subagent)
  if (toolName === "Task") {
    const subagentType = typeof toolInput.subagent_type === "string" ? toolInput.subagent_type : "";
    const description = typeof toolInput.description === "string" ? toolInput.description : "";
    const label = subagentType && description
      ? `${subagentType}: ${truncateStr(description, 60)}`
      : subagentType || description || "Running subagent";
    return {
      activity_kind: "editing",
      phase: "editing",
      action_label: label,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Web tools
  if (WEB_TOOLS.has(toolName)) {
    const url = typeof toolInput.url === "string" ? truncateStr(toolInput.url) : "URL";
    return {
      activity_kind: "web_fetch",
      phase: "editing",
      action_label: `Fetching ${url}`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  if (SEARCH_TOOLS.has(toolName)) {
    const query = typeof toolInput.query === "string" ? truncateStr(toolInput.query) : "web";
    return {
      activity_kind: "web_search",
      phase: "editing",
      action_label: `Searching: ${query}`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // AskUserQuestion
  if (toolName === "AskUserQuestion") {
    return {
      activity_kind: "ask_user",
      phase: "waiting",
      action_label: "Asking developer a question",
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Todo / Task management tools
  if (TODO_TOOLS.has(toolName)) {
    return {
      activity_kind: "todo_action",
      phase: "editing",
      action_label: `${toolName}`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Plan mode tools
  if (PLAN_TOOLS.has(toolName)) {
    const entering = toolName === "EnterPlanMode";
    return {
      activity_kind: "plan_mode",
      phase: entering ? "editing" : "editing",
      action_label: entering ? "Entering plan mode" : "Exiting plan mode",
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Skill invocation
  if (toolName === "Skill") {
    const skill = typeof toolInput.skill === "string" ? toolInput.skill : "skill";
    return {
      activity_kind: "skill_invoke",
      phase: "editing",
      action_label: `Running skill: ${skill}`,
      files_touched: [],
      is_completion: false,
      is_session_start: false,
      content_type: "tool_use",
    };
  }

  // Default
  return {
    activity_kind: "unknown",
    phase: "editing",
    action_label: toolName || "Unknown action",
    files_touched: [],
    is_completion: false,
    is_session_start: false,
    content_type: "tool_use",
  };
}

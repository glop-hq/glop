import { schema, type DbClient } from "./db";

// Tools that never require explicit user permission — recording them would
// create noise and make approval-rate analysis meaningless.
const AUTO_ALLOWED_TOOLS = new Set([
  "Read",
  "Glob",
  "Grep",
  "TodoRead",
  "TaskList",
  "TaskGet",
  "TaskOutput",
  "WebSearch",
  "WebFetch",
  "EnterPlanMode",
  "ExitPlanMode",
  "AskUserQuestion",
]);

const MAX_TOOL_ARGS_LENGTH = 512;

interface PermissionEventContext {
  run_id: string;
  event_id: string;
  repo_id: string;
  developer_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  occurred_at: string;
}

/**
 * Generalize a tool call into a permission pattern like `Edit(src/components/**)`.
 *
 * Strategy: keep the first 2 directory segments of file paths and wildcard the rest.
 * For Bash commands, keep the first 2 tokens and wildcard the rest.
 */
export function generalizePermissionPattern(
  toolName: string,
  toolInput: Record<string, unknown>
): { pattern: string; toolArgs: string | null } {
  // File-based tools: Edit, Write, Read, NotebookEdit
  const filePath =
    typeof toolInput.file_path === "string"
      ? toolInput.file_path
      : typeof toolInput.path === "string"
        ? toolInput.path
        : null;

  if (filePath) {
    const segments = filePath.replace(/^\//, "").split("/");
    const kept = segments.slice(0, 2).join("/");
    const pattern = segments.length > 2
      ? `${toolName}(${kept}/**)`
      : `${toolName}(${kept})`;
    return { pattern, toolArgs: filePath };
  }

  // Bash tool: generalize by first 2 command tokens
  if (toolName === "Bash" && typeof toolInput.command === "string") {
    const command = toolInput.command.trim();
    const tokens = command.split(/\s+/);
    const kept = tokens.slice(0, 2).join(" ");
    const pattern = tokens.length > 2
      ? `Bash(${kept} *)`
      : `Bash(${kept})`;
    return { pattern, toolArgs: command };
  }

  // Glob/Grep: use the pattern or path arg
  if (
    (toolName === "Glob" || toolName === "Grep") &&
    typeof toolInput.pattern === "string"
  ) {
    return {
      pattern: `${toolName}(*)`,
      toolArgs: toolInput.pattern,
    };
  }

  // Default fallback
  return { pattern: `${toolName}(*)`, toolArgs: null };
}

/**
 * Record a permission event (tool approval) detected from a PostToolUse hook.
 * Skips tools that are auto-allowed and never prompt the user.
 * Best-effort — errors are logged but do not fail the hook pipeline.
 */
export async function recordPermissionEvent(
  db: DbClient,
  workspaceId: string,
  ctx: PermissionEventContext
): Promise<void> {
  // Skip tools that never require explicit permission
  if (AUTO_ALLOWED_TOOLS.has(ctx.tool_name)) return;

  const { pattern, toolArgs } = generalizePermissionPattern(
    ctx.tool_name,
    ctx.tool_input
  );

  const truncatedArgs =
    toolArgs && toolArgs.length > MAX_TOOL_ARGS_LENGTH
      ? toolArgs.slice(0, MAX_TOOL_ARGS_LENGTH)
      : toolArgs;

  await db.insert(schema.permission_events).values({
    run_id: ctx.run_id,
    event_id: ctx.event_id,
    repo_id: ctx.repo_id,
    workspace_id: workspaceId,
    developer_id: ctx.developer_id,
    tool_name: ctx.tool_name,
    tool_args: truncatedArgs,
    pattern,
    outcome: "prompted",
    created_at: ctx.occurred_at,
  });
}

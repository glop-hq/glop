import { eq, and, desc, sql } from "drizzle-orm";
import { schema, type DbClient } from "./db";
import {
  deriveRunPatch,
  shouldCreateNewRun,
  type Run,
  type EventType,
  type ClassifiedActivity,
} from "@glop/shared";
import { classifyHookPayload, type ClassifiedHook } from "./hook-classifier";
import { extractBashOutput, extractCommitArtifact, extractPrArtifact } from "./artifact-extractor";
import { resolveOrCreateDeveloper, resolveOrCreateRepo } from "./entity-resolver";
import { recordMcpUsage } from "./mcp-usage";

function generateId(): string {
  return crypto.randomUUID();
}

export interface HookContext {
  developer_id: string;
  developer_name: string;
  machine_id: string;
  repo_key: string;
  branch_name: string;
  session_id?: string;
  slug?: string;
  git_user_name: string | null;
  git_user_email: string | null;
  workspace_id: string;
  user_id?: string | null;
}

export interface ProcessedResult {
  run_id: string;
  event_id: string;
}

function hookToEventType(classified: ClassifiedHook, isNewRun: boolean): EventType {
  switch (classified.content_type) {
    case "prompt":
      return "run.prompt";
    case "response":
      return "run.response";
    case "permission_request":
      return "run.permission_request";
    case "context_compacted":
      return "run.context_compacted";
    case "session_end":
      return "run.completed";
    case "session_start":
      return isNewRun ? "run.started" : "run.heartbeat";
    case "tool_use":
      if (isNewRun) return "run.started";
      return "run.tool_use";
    default:
      if (isNewRun) return "run.started";
      return "run.heartbeat";
  }
}

function toClassifiedActivity(hook: ClassifiedHook): ClassifiedActivity {
  return {
    activity_kind: hook.activity_kind,
    phase: hook.phase,
    action_label: hook.action_label,
    files_touched: hook.files_touched,
  };
}

export async function processHook(
  db: DbClient,
  hookType: string,
  rawPayload: Record<string, unknown>,
  ctx: HookContext
): Promise<ProcessedResult> {
  const now = new Date().toISOString();
  const classified = classifyHookPayload(hookType, rawPayload);

  let existingRun: typeof schema.runs.$inferSelect | null = null;
  let matchedBySessionId = false;

  // First, try to find existing run by session_id (most reliable)
  if (ctx.session_id) {
    const sessionRuns = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.session_id, ctx.session_id))
      .orderBy(desc(schema.runs.created_at))
      .limit(1);
    if (sessionRuns[0]) {
      existingRun = sessionRuns[0];
      matchedBySessionId = true;
    }
  }

  // Try slug-based matching: find a run with the same conversation slug + developer
  if (!existingRun && ctx.slug) {
    const slugRuns = await db
      .select()
      .from(schema.runs)
      .where(
        and(
          eq(schema.runs.slug, ctx.slug),
          eq(schema.runs.developer_id, ctx.developer_id)
        )
      )
      .orderBy(desc(schema.runs.created_at))
      .limit(1);
    if (slugRuns[0]) {
      existingRun = slugRuns[0];
      matchedBySessionId = true; // treat as matched to skip shouldCreateNewRun
      // Update the run's session_id to the new session
      if (ctx.session_id && existingRun.session_id !== ctx.session_id) {
        await db
          .update(schema.runs)
          .set({ session_id: ctx.session_id })
          .where(eq(schema.runs.id, existingRun.id));
      }
    }
  }

  const needsNewRun = shouldCreateNewRun(existingRun as Run | null, matchedBySessionId);

  // Completion event with no open run — skip entity resolution and bail
  if (!needsNewRun && !existingRun) {
    return { run_id: "", event_id: "" };
  }

  // Resolve entity records in parallel
  const [developerEntityId, repoId] = await Promise.all([
    resolveOrCreateDeveloper(db, ctx.workspace_id, {
      developer_id: ctx.developer_id,
      developer_name: ctx.developer_name,
      git_user_email: ctx.git_user_email,
      git_user_name: ctx.git_user_name,
    }, now),
    resolveOrCreateRepo(db, ctx.workspace_id, ctx.repo_key, now),
  ]);

  let runId: string;

  if (needsNewRun && !classified.is_completion) {
    // Create new run
    runId = generateId();

    // Look up workspace default visibility
    const [ws] = await db
      .select({ default_run_visibility: schema.workspaces.default_run_visibility })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, ctx.workspace_id))
      .limit(1);

    await db.insert(schema.runs).values({
      id: runId,
      workspace_id: ctx.workspace_id,
      visibility: ws?.default_run_visibility ?? "workspace",
      owner_user_id: ctx.user_id || null,
      developer_entity_id: developerEntityId,
      repo_id: repoId,
      developer_id: ctx.developer_id,
      machine_id: ctx.machine_id,
      repo_key: ctx.repo_key,
      branch_name: ctx.branch_name,
      session_id: ctx.session_id || null,
      slug: ctx.slug || null,
      git_user_name: ctx.git_user_name,
      git_user_email: ctx.git_user_email,
      status: "active",
      phase: classified.phase === "done" ? "unknown" : classified.phase,
      activity_kind: classified.activity_kind,
      title: `${ctx.developer_name} working on ${ctx.repo_key}`,
      current_action: classified.action_label,
      last_action_label: classified.action_label,
      file_count: classified.files_touched.length,
      files_touched: classified.files_touched,
      started_at: now,
      last_heartbeat_at: now,
      last_event_at: now,
      event_count: 1,
      created_at: now,
      updated_at: now,
    });

    // If the new run has a slug, check for a parent run with the same slug
    if (ctx.slug) {
      const parentRuns = await db
        .select({ id: schema.runs.id })
        .from(schema.runs)
        .where(
          and(
            eq(schema.runs.slug, ctx.slug),
            eq(schema.runs.developer_id, ctx.developer_id)
          )
        )
        .orderBy(desc(schema.runs.created_at))
        .limit(1);
      if (parentRuns[0] && parentRuns[0].id !== runId) {
        await db
          .update(schema.runs)
          .set({ parent_run_id: parentRuns[0].id })
          .where(eq(schema.runs.id, runId));
      }
    }
  } else if (existingRun) {
    runId = existingRun.id;
    // Map to a run-level event type for deriving the patch
    const runEventType = classified.is_completion
      ? "run.completed" as EventType
      : "run.heartbeat" as EventType;
    const activity = toClassifiedActivity(classified);
    const patch = deriveRunPatch(existingRun as Run, runEventType, activity, now);

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Backfill entity FKs on existing runs that predate this feature
    if (!existingRun.developer_entity_id && developerEntityId) {
      updateData.developer_entity_id = developerEntityId;
    }
    if (!existingRun.repo_id && repoId) {
      updateData.repo_id = repoId;
    }

    // Store slug on the run if it doesn't have one yet
    if (ctx.slug && !existingRun.slug) {
      updateData.slug = ctx.slug;

      // Link to parent: find the most recent OTHER run with the same slug
      const parentRuns = await db
        .select({ id: schema.runs.id })
        .from(schema.runs)
        .where(
          and(
            eq(schema.runs.slug, ctx.slug),
            eq(schema.runs.developer_id, ctx.developer_id)
          )
        )
        .orderBy(desc(schema.runs.created_at))
        .limit(1);
      if (parentRuns[0] && parentRuns[0].id !== existingRun.id) {
        updateData.parent_run_id = parentRuns[0].id;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(schema.runs)
        .set(updateData)
        .where(eq(schema.runs.id, runId));
    }
  } else {
    // Should not reach here — guarded by early return above
    return { run_id: "", event_id: "" };
  }

  // Insert event
  const eventId = generateId();
  const eventType = hookToEventType(classified, needsNewRun && !classified.is_completion);

  await db.insert(schema.events).values({
    id: eventId,
    event_type: eventType,
    occurred_at: now,
    received_at: now,
    run_id: runId,
    developer_id: ctx.developer_id,
    machine_id: ctx.machine_id,
    repo_key: ctx.repo_key,
    branch_name: ctx.branch_name,
    payload: {
      hook_type: hookType,
      tool_name: rawPayload.tool_name,
      tool_input: rawPayload.tool_input,
      tool_response: rawPayload.tool_response,
      activity_kind: classified.activity_kind,
      action_label: classified.action_label,
      files_touched: classified.files_touched,
      content_type: classified.content_type,
      content: classified.content,
      // Preserve conversation slug for session linking
      ...(rawPayload.slug ? { slug: rawPayload.slug } : {}),
    },
  });

  // Extract commit/PR artifacts from PostToolUse Bash commands
  if (
    hookType === "PostToolUse" &&
    rawPayload.tool_name === "Bash" &&
    rawPayload.tool_response != null
  ) {
    const command =
      typeof (rawPayload.tool_input as Record<string, unknown>)?.command === "string"
        ? (rawPayload.tool_input as Record<string, unknown>).command as string
        : "";
    const output = extractBashOutput(rawPayload.tool_response);

    const commit = extractCommitArtifact(command, output, ctx.repo_key);
    if (commit) {
      const existing = await db
        .select({ id: schema.artifacts.id })
        .from(schema.artifacts)
        .where(
          and(
            eq(schema.artifacts.run_id, runId),
            eq(schema.artifacts.artifact_type, "commit"),
            eq(schema.artifacts.external_id, commit.external_id)
          )
        )
        .limit(1);
      if (existing.length === 0) {
        const diffStats = rawPayload.commit_diff_stats as
          | { files_changed: number; lines_added: number; lines_removed: number }
          | undefined;
        await db.insert(schema.artifacts).values({
          id: generateId(),
          run_id: runId,
          artifact_type: "commit",
          url: commit.url,
          label: commit.label,
          external_id: commit.external_id,
          state: null,
          metadata: diffStats
            ? {
                files_changed: diffStats.files_changed,
                lines_added: diffStats.lines_added,
                lines_removed: diffStats.lines_removed,
              }
            : {},
          created_at: now,
        });
      }
    }

    const pr = extractPrArtifact(command, output);
    if (pr) {
      const existing = await db
        .select({ id: schema.artifacts.id })
        .from(schema.artifacts)
        .where(
          and(
            eq(schema.artifacts.run_id, runId),
            eq(schema.artifacts.artifact_type, "pr"),
            eq(schema.artifacts.external_id, pr.external_id)
          )
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.artifacts).values({
          id: generateId(),
          run_id: runId,
          artifact_type: "pr",
          url: pr.url,
          label: pr.label,
          external_id: pr.external_id,
          state: "open",
          metadata: {},
          created_at: now,
        });
      }
    }
  }

  // Detect MCP tool usage from tool_name pattern: mcp__<server>__<tool>
  if (hookType === "PostToolUse" && typeof rawPayload.tool_name === "string") {
    const parts = (rawPayload.tool_name as string).split("__");
    if (parts.length >= 3 && parts[0] === "mcp") {
      const serverAlias = parts[1];
      const toolNameStr = parts.slice(2).join("__");
      // Detect errors: check for structured error indicators rather than
      // substring matching, which would false-positive on normal prose
      const isError = rawPayload.tool_response != null && (
        // Claude Code sets tool_response to an object with isError
        (typeof rawPayload.tool_response === "object" &&
          (rawPayload.tool_response as Record<string, unknown>).isError === true) ||
        // String responses starting with "Error:" or connection failures
        (typeof rawPayload.tool_response === "string" &&
          /^(Error:|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)\b/.test(rawPayload.tool_response))
      );
      try {
        await recordMcpUsage(db, ctx.workspace_id, serverAlias, toolNameStr, {
          run_id: runId,
          event_id: eventId,
          developer_entity_id: developerEntityId,
          repo_id: repoId,
          occurred_at: now,
          is_error: isError,
        });
      } catch (err) {
        // MCP usage tracking is best-effort — don't fail the hook
        console.error("MCP usage recording error:", err);
      }
    }
  }

  return { run_id: runId, event_id: eventId };
}

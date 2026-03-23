import { eq, and } from "drizzle-orm";
import { schema, type DbClient } from "./db";

interface StandardUsageContext {
  run_id: string;
  event_id: string;
  developer_entity_id: string | null;
  repo_id: string | null;
  occurred_at: string;
}

/**
 * Record standard (skill/command/agent) usage detected from a PostToolUse event.
 *
 * 1. Resolve standard_id by looking up claude_items for this repo
 * 2. Determine actual type (skill vs command) from claude_items if possible
 * 3. Insert standard_usage row
 */
export async function recordStandardUsage(
  db: DbClient,
  workspaceId: string,
  standardName: string,
  standardType: "skill" | "command" | "hook" | "agent",
  ctx: StandardUsageContext
): Promise<void> {
  let resolvedStandardId: string | null = null;
  let resolvedType = standardType;

  // Try to resolve standard_id from claude_items and determine actual type
  // Skills and commands both come through the Skill tool — check claude_items
  // to determine the actual kind
  if (ctx.repo_id && (standardType === "skill" || standardType === "command")) {
    const items = await db
      .select({
        id: schema.claude_items.id,
        kind: schema.claude_items.kind,
      })
      .from(schema.claude_items)
      .where(
        and(
          eq(schema.claude_items.repo_id, ctx.repo_id),
          eq(schema.claude_items.name, standardName)
        )
      )
      .limit(1);

    if (items.length > 0) {
      resolvedStandardId = items[0].id;
      // Use the actual kind from claude_items (skill or command)
      resolvedType = items[0].kind as "skill" | "command";
    }
  }

  await db.insert(schema.standard_usage).values({
    run_id: ctx.run_id,
    event_id: ctx.event_id,
    repo_id: ctx.repo_id!,
    workspace_id: workspaceId,
    developer_entity_id: ctx.developer_entity_id,
    standard_id: resolvedStandardId,
    standard_name: standardName,
    standard_type: resolvedType,
    created_at: ctx.occurred_at,
  });
}

import { eq, and, sql } from "drizzle-orm";
import { schema, type DbClient } from "./db";

interface McpUsageContext {
  run_id: string;
  event_id: string;
  developer_entity_id: string | null;
  repo_id: string | null;
  occurred_at: string;
  is_error?: boolean;
}

/**
 * Record MCP tool usage detected from a `mcp__<server>__<tool>` event.
 *
 * 1. Resolve server alias → canonical workspace_mcp entry (create provisional if missing)
 * 2. Check for blocked MCP → alert
 * 3. Upsert mcp_tools
 * 4. Insert mcp_usage row
 * 5. Check for new repo usage → alert
 */
export async function recordMcpUsage(
  db: DbClient,
  workspaceId: string,
  serverAlias: string,
  toolName: string,
  ctx: McpUsageContext
): Promise<void> {
  const now = ctx.occurred_at;

  // 1. Look up alias → canonical MCP
  let mcpId: string | null = null;

  const aliasRows = await db
    .select({
      workspace_mcp_id: schema.mcp_aliases.workspace_mcp_id,
      status: schema.workspace_mcps.status,
    })
    .from(schema.mcp_aliases)
    .innerJoin(
      schema.workspace_mcps,
      eq(schema.mcp_aliases.workspace_mcp_id, schema.workspace_mcps.id)
    )
    .where(
      and(
        eq(schema.mcp_aliases.alias, serverAlias),
        eq(schema.workspace_mcps.workspace_id, workspaceId)
      )
    )
    .limit(1);

  if (aliasRows.length > 0) {
    mcpId = aliasRows[0].workspace_mcp_id;

    // 2. Check if blocked → alert
    if (aliasRows[0].status === "blocked") {
      await db.insert(schema.mcp_alerts).values({
        workspace_id: workspaceId,
        workspace_mcp_id: mcpId,
        alert_type: "blocked_mcp_usage",
        severity: "high",
        title: `Blocked MCP "${serverAlias}" was used`,
        detail: `Tool ${toolName} was called on blocked MCP "${serverAlias}".`,
        context: {
          run_id: ctx.run_id,
          developer_entity_id: ctx.developer_entity_id,
          repo_id: ctx.repo_id,
          tool_name: toolName,
        },
      });
    }
  } else {
    // Create provisional entry keyed by alias
    const [newMcp] = await db
      .insert(schema.workspace_mcps)
      .values({
        workspace_id: workspaceId,
        canonical_id: serverAlias,
        transport: "stdio",
        status: "pending",
        first_seen_at: now,
        last_seen_at: now,
      })
      .onConflictDoUpdate({
        target: [schema.workspace_mcps.workspace_id, schema.workspace_mcps.canonical_id],
        set: { last_seen_at: now, updated_at: now },
      })
      .returning({ id: schema.workspace_mcps.id });

    mcpId = newMcp.id;

    // Create alias
    await db
      .insert(schema.mcp_aliases)
      .values({ workspace_mcp_id: mcpId, alias: serverAlias })
      .onConflictDoNothing();

    // Alert: new MCP discovered
    await db.insert(schema.mcp_alerts).values({
      workspace_id: workspaceId,
      workspace_mcp_id: mcpId,
      alert_type: "new_mcp_discovered",
      severity: "info",
      title: `New MCP discovered: "${serverAlias}"`,
      detail: `MCP "${serverAlias}" was detected from tool usage. Review and set approval status.`,
      context: {
        run_id: ctx.run_id,
        source: "event_detection",
      },
    });
  }

  // Update last_seen_at on the MCP
  await db
    .update(schema.workspace_mcps)
    .set({ last_seen_at: now, updated_at: now })
    .where(eq(schema.workspace_mcps.id, mcpId));

  // 3. Upsert mcp_tools
  const [tool] = await db
    .insert(schema.mcp_tools)
    .values({
      workspace_mcp_id: mcpId,
      tool_name: toolName,
      call_count: 1,
      error_count: ctx.is_error ? 1 : 0,
      first_seen_at: now,
      last_seen_at: now,
    })
    .onConflictDoUpdate({
      target: [schema.mcp_tools.workspace_mcp_id, schema.mcp_tools.tool_name],
      set: {
        call_count: sql`${schema.mcp_tools.call_count} + 1`,
        error_count: ctx.is_error
          ? sql`${schema.mcp_tools.error_count} + 1`
          : schema.mcp_tools.error_count,
        last_seen_at: now,
      },
    })
    .returning({ id: schema.mcp_tools.id });

  // 4. Insert mcp_usage
  await db.insert(schema.mcp_usage).values({
    workspace_id: workspaceId,
    workspace_mcp_id: mcpId,
    mcp_tool_id: tool?.id ?? null,
    run_id: ctx.run_id,
    event_id: ctx.event_id,
    repo_id: ctx.repo_id,
    developer_entity_id: ctx.developer_entity_id,
    tool_name: toolName,
    is_error: ctx.is_error ?? false,
    occurred_at: now,
  });

  // 5. Check if this is a new repo for this MCP
  if (ctx.repo_id) {
    const priorRepoUsage = await db
      .select({ id: schema.mcp_usage.id })
      .from(schema.mcp_usage)
      .where(
        and(
          eq(schema.mcp_usage.workspace_mcp_id, mcpId),
          eq(schema.mcp_usage.repo_id, ctx.repo_id)
        )
      )
      .limit(2);

    // If this is the first usage record for this repo+mcp combo (just inserted)
    if (priorRepoUsage.length <= 1) {
      await db.insert(schema.mcp_alerts).values({
        workspace_id: workspaceId,
        workspace_mcp_id: mcpId,
        alert_type: "mcp_in_new_repo",
        severity: "low",
        title: `MCP "${serverAlias}" used in a new repo`,
        detail: `MCP "${serverAlias}" was used in a repo where it hasn't been seen before.`,
        context: {
          run_id: ctx.run_id,
          repo_id: ctx.repo_id,
        },
      });
    }
  }

  // 6. Error rate spike detection
  if (ctx.is_error) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [recentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) FILTER (WHERE is_error)::int`,
      })
      .from(schema.mcp_usage)
      .where(
        and(
          eq(schema.mcp_usage.workspace_mcp_id, mcpId),
          sql`${schema.mcp_usage.occurred_at} >= ${oneHourAgo}`
        )
      );

    const total = Number(recentStats?.total ?? 0);
    const errors = Number(recentStats?.errors ?? 0);

    // Alert if >50% error rate over 10+ calls in the last hour
    if (total >= 10 && errors / total > 0.5) {
      // Deduplicate: skip if an error_rate_spike alert exists within the last hour
      const [existing] = await db
        .select({ id: schema.mcp_alerts.id })
        .from(schema.mcp_alerts)
        .where(
          and(
            eq(schema.mcp_alerts.workspace_mcp_id, mcpId),
            eq(schema.mcp_alerts.alert_type, "error_rate_spike"),
            sql`${schema.mcp_alerts.created_at} >= ${oneHourAgo}`
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(schema.mcp_alerts).values({
          workspace_id: workspaceId,
          workspace_mcp_id: mcpId,
          alert_type: "error_rate_spike",
          severity: "medium",
          title: `High error rate on MCP "${serverAlias}"`,
          detail: `${errors}/${total} calls (${Math.round((errors / total) * 100)}%) errored in the last hour.`,
          context: {
            error_count: errors,
            total_count: total,
            error_rate: Math.round((errors / total) * 100),
          },
        });
      }
    }
  }
}

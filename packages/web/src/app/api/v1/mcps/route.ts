import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { mcpQuerySchema } from "@glop/shared/validation";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { AnalyticsPeriod, McpServer, McpComplianceSummary } from "@glop/shared";

export const dynamic = "force-dynamic";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;

    const parsed = mcpQuerySchema.safeParse({
      workspace_id: sp.get("workspace_id") ?? undefined,
      status: sp.get("status") ?? undefined,
      period: sp.get("period") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id, status, period } = parsed.data;
    requireWorkspaceMember(session, workspace_id);

    const db = getDb();
    const days = PERIOD_DAYS[period];
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    const periodStartStr = periodStart.toISOString();

    // Base filter
    const mcpWhere = status
      ? and(
          eq(schema.workspace_mcps.workspace_id, workspace_id),
          eq(schema.workspace_mcps.status, status)
        )
      : eq(schema.workspace_mcps.workspace_id, workspace_id);

    // Fetch MCPs with aggregated stats
    const mcpRows = await db
      .select({
        id: schema.workspace_mcps.id,
        canonical_id: schema.workspace_mcps.canonical_id,
        transport: schema.workspace_mcps.transport,
        display_name: schema.workspace_mcps.display_name,
        description: schema.workspace_mcps.description,
        status: schema.workspace_mcps.status,
        setup_guidance: schema.workspace_mcps.setup_guidance,
        status_note: schema.workspace_mcps.status_note,
        first_seen_at: schema.workspace_mcps.first_seen_at,
        last_seen_at: schema.workspace_mcps.last_seen_at,
        usage_count: sql<number>`(
          SELECT count(*)::int FROM mcp_usage
          WHERE workspace_mcp_id = ${schema.workspace_mcps.id}
          AND occurred_at >= ${periodStartStr}
        )`,
        error_count: sql<number>`(
          SELECT count(*)::int FROM mcp_usage
          WHERE workspace_mcp_id = ${schema.workspace_mcps.id}
          AND occurred_at >= ${periodStartStr}
          AND is_error = true
        )`,
        repo_count: sql<number>`(
          SELECT count(DISTINCT repo_id)::int FROM mcp_usage
          WHERE workspace_mcp_id = ${schema.workspace_mcps.id}
          AND occurred_at >= ${periodStartStr}
          AND repo_id IS NOT NULL
        )`,
        developer_count: sql<number>`(
          SELECT count(DISTINCT developer_entity_id)::int FROM mcp_usage
          WHERE workspace_mcp_id = ${schema.workspace_mcps.id}
          AND occurred_at >= ${periodStartStr}
          AND developer_entity_id IS NOT NULL
        )`,
      })
      .from(schema.workspace_mcps)
      .where(mcpWhere)
      .orderBy(sql`last_seen_at DESC`);

    // Fetch aliases and tools for all MCPs in one query each
    const mcpIds = mcpRows.map((r) => r.id);

    const [aliasRows, toolRows] = mcpIds.length > 0
      ? await Promise.all([
          db
            .select({
              workspace_mcp_id: schema.mcp_aliases.workspace_mcp_id,
              alias: schema.mcp_aliases.alias,
            })
            .from(schema.mcp_aliases)
            .where(sql`${schema.mcp_aliases.workspace_mcp_id} = ANY(${mcpIds})`),
          db
            .select({
              workspace_mcp_id: schema.mcp_tools.workspace_mcp_id,
              id: schema.mcp_tools.id,
              tool_name: schema.mcp_tools.tool_name,
              call_count: schema.mcp_tools.call_count,
              error_count: schema.mcp_tools.error_count,
              first_seen_at: schema.mcp_tools.first_seen_at,
              last_seen_at: schema.mcp_tools.last_seen_at,
            })
            .from(schema.mcp_tools)
            .where(sql`${schema.mcp_tools.workspace_mcp_id} = ANY(${mcpIds})`),
        ])
      : [[], []];

    // Group aliases and tools by MCP
    const aliasesByMcp = new Map<string, string[]>();
    for (const a of aliasRows) {
      const list = aliasesByMcp.get(a.workspace_mcp_id) ?? [];
      list.push(a.alias);
      aliasesByMcp.set(a.workspace_mcp_id, list);
    }

    const toolsByMcp = new Map<string, typeof toolRows>();
    for (const t of toolRows) {
      const list = toolsByMcp.get(t.workspace_mcp_id) ?? [];
      list.push(t);
      toolsByMcp.set(t.workspace_mcp_id, list);
    }

    const mcps: McpServer[] = mcpRows.map((r) => ({
      id: r.id,
      canonical_id: r.canonical_id,
      transport: r.transport,
      display_name: r.display_name,
      description: r.description,
      status: r.status,
      setup_guidance: r.setup_guidance,
      status_note: r.status_note,
      aliases: aliasesByMcp.get(r.id) ?? [],
      tools: (toolsByMcp.get(r.id) ?? []).map((t) => ({
        id: t.id,
        tool_name: t.tool_name,
        call_count: t.call_count,
        error_count: t.error_count,
        first_seen_at: t.first_seen_at,
        last_seen_at: t.last_seen_at,
      })),
      usage_count: Number(r.usage_count),
      error_count: Number(r.error_count),
      repo_count: Number(r.repo_count),
      developer_count: Number(r.developer_count),
      first_seen_at: r.first_seen_at,
      last_seen_at: r.last_seen_at,
    }));

    // Compliance summary
    const byStatus: Record<string, number> = {
      pending: 0,
      approved: 0,
      flagged: 0,
      blocked: 0,
    };
    for (const m of mcps) {
      byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    }

    const totalUsage = mcps.reduce((s, m) => s + m.usage_count, 0);
    const approvedUsage = mcps
      .filter((m) => m.status === "approved")
      .reduce((s, m) => s + m.usage_count, 0);

    // Count recent unacknowledged alerts
    const [alertCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mcp_alerts)
      .where(
        and(
          eq(schema.mcp_alerts.workspace_id, workspace_id),
          eq(schema.mcp_alerts.acknowledged, false)
        )
      );

    const compliance: McpComplianceSummary = {
      total_mcps: mcps.length,
      by_status: byStatus as Record<string, number>,
      compliance_rate:
        totalUsage > 0 ? Math.round((approvedUsage / totalUsage) * 100) : 0,
      total_usage: totalUsage,
      approved_usage: approvedUsage,
      recent_alerts: Number(alertCount?.count ?? 0),
    };

    return NextResponse.json({ mcps, compliance });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json(
        { error: error.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    console.error("MCP list error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

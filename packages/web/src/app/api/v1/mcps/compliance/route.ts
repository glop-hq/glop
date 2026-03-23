import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { McpComplianceSummary } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;
    const workspaceId = sp.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    requireWorkspaceMember(session, workspaceId);

    const db = getDb();

    const [statusCounts, usageCounts, alertCount] = await Promise.all([
      // Count MCPs by status
      db
        .select({
          status: schema.workspace_mcps.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.workspace_mcps)
        .where(eq(schema.workspace_mcps.workspace_id, workspaceId))
        .groupBy(schema.workspace_mcps.status),

      // Usage split by approved vs total
      db
        .select({
          total: sql<number>`count(*)::int`,
          approved: sql<number>`count(*) FILTER (WHERE ${schema.workspace_mcps.status} = 'approved')::int`,
        })
        .from(schema.mcp_usage)
        .innerJoin(
          schema.workspace_mcps,
          eq(schema.mcp_usage.workspace_mcp_id, schema.workspace_mcps.id)
        )
        .where(eq(schema.mcp_usage.workspace_id, workspaceId)),

      // Unacknowledged alerts
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.mcp_alerts)
        .where(
          and(
            eq(schema.mcp_alerts.workspace_id, workspaceId),
            eq(schema.mcp_alerts.acknowledged, false)
          )
        ),
    ]);

    const byStatus: Record<string, number> = {
      pending: 0,
      approved: 0,
      flagged: 0,
      blocked: 0,
    };
    let totalMcps = 0;
    for (const row of statusCounts) {
      byStatus[row.status] = Number(row.count);
      totalMcps += Number(row.count);
    }

    const totalUsage = Number(usageCounts[0]?.total ?? 0);
    const approvedUsage = Number(usageCounts[0]?.approved ?? 0);

    const compliance: McpComplianceSummary = {
      total_mcps: totalMcps,
      by_status: byStatus,
      compliance_rate:
        totalUsage > 0 ? Math.round((approvedUsage / totalUsage) * 100) : 0,
      total_usage: totalUsage,
      approved_usage: approvedUsage,
      recent_alerts: Number(alertCount[0]?.count ?? 0),
    };

    return NextResponse.json(compliance);
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
    console.error("MCP compliance error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

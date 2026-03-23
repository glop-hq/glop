import { NextRequest, NextResponse } from "next/server";
import { sql, eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;
    const workspaceId = sp.get("workspace_id");
    const acknowledged = sp.get("acknowledged");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    requireWorkspaceMember(session, workspaceId);

    const db = getDb();

    const conditions = [eq(schema.mcp_alerts.workspace_id, workspaceId)];
    if (acknowledged === "false") {
      conditions.push(eq(schema.mcp_alerts.acknowledged, false));
    } else if (acknowledged === "true") {
      conditions.push(eq(schema.mcp_alerts.acknowledged, true));
    }

    const rows = await db
      .select({
        id: schema.mcp_alerts.id,
        alert_type: schema.mcp_alerts.alert_type,
        severity: schema.mcp_alerts.severity,
        title: schema.mcp_alerts.title,
        detail: schema.mcp_alerts.detail,
        context: schema.mcp_alerts.context,
        mcp_id: schema.mcp_alerts.workspace_mcp_id,
        mcp_canonical_id: schema.workspace_mcps.canonical_id,
        acknowledged: schema.mcp_alerts.acknowledged,
        acknowledged_by: schema.mcp_alerts.acknowledged_by,
        created_at: schema.mcp_alerts.created_at,
      })
      .from(schema.mcp_alerts)
      .leftJoin(
        schema.workspace_mcps,
        eq(schema.mcp_alerts.workspace_mcp_id, schema.workspace_mcps.id)
      )
      .where(and(...conditions))
      .orderBy(desc(schema.mcp_alerts.created_at))
      .limit(100);

    return NextResponse.json({
      alerts: rows.map((r) => ({
        id: r.id,
        alert_type: r.alert_type,
        severity: r.severity,
        title: r.title,
        detail: r.detail,
        context: r.context,
        mcp_id: r.mcp_id,
        mcp_canonical_id: r.mcp_canonical_id,
        acknowledged: r.acknowledged,
        acknowledged_by: r.acknowledged_by,
        created_at: r.created_at,
      })),
    });
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
    console.error("MCP alerts error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

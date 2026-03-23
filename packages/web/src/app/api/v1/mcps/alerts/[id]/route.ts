import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { mcpAlertAcknowledgeSchema } from "@glop/shared/validation";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  isWorkspaceAdmin,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const body = await request.json();
    const parsed = mcpAlertAcknowledgeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id } = parsed.data;
    requireWorkspaceMember(session, workspace_id);

    if (!isWorkspaceAdmin(session, workspace_id)) {
      return NextResponse.json(
        { error: "Admin role required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const db = getDb();

    const [updated] = await db
      .update(schema.mcp_alerts)
      .set({
        acknowledged: true,
        acknowledged_by: session.email,
      })
      .where(
        and(
          eq(schema.mcp_alerts.id, id),
          eq(schema.mcp_alerts.workspace_id, workspace_id)
        )
      )
      .returning({ id: schema.mcp_alerts.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Alert not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: updated.id, acknowledged: true });
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
    console.error("MCP alert acknowledge error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

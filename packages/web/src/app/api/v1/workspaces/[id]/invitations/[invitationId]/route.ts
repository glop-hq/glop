import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId, invitationId } = await params;

    if (!isWorkspaceAdmin(session, workspaceId)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const db = getDb();

    const invitation = await db
      .select()
      .from(schema.workspace_invitations)
      .where(
        and(
          eq(schema.workspace_invitations.id, invitationId),
          eq(schema.workspace_invitations.workspace_id, workspaceId),
          eq(schema.workspace_invitations.status, "pending")
        )
      )
      .limit(1);

    if (invitation.length === 0) {
      return NextResponse.json(
        { error: "Invitation not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    await db
      .update(schema.workspace_invitations)
      .set({ status: "revoked" })
      .where(eq(schema.workspace_invitations.id, invitationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Cancel invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

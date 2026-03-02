import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin } from "@/lib/workspace-auth";
import { memberRoleSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId, memberId } = await params;

    if (!isWorkspaceAdmin(session, workspaceId)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = memberRoleSchema.safeParse(body.role);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid role", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const newRole = parsed.data;
    const db = getDb();

    // Find the member
    const members = await db
      .select()
      .from(schema.workspace_members)
      .where(
        and(
          eq(schema.workspace_members.id, memberId),
          eq(schema.workspace_members.workspace_id, workspaceId)
        )
      )
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        { error: "Member not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const member = members[0];

    // Prevent demoting the last admin
    if (member.role === "admin" && newRole === "member") {
      const adminCount = await db
        .select()
        .from(schema.workspace_members)
        .where(
          and(
            eq(schema.workspace_members.workspace_id, workspaceId),
            eq(schema.workspace_members.role, "admin")
          )
        );

      if (adminCount.length <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin", code: "LAST_ADMIN" },
          { status: 400 }
        );
      }
    }

    await db
      .update(schema.workspace_members)
      .set({ role: newRole })
      .where(eq(schema.workspace_members.id, memberId));

    return NextResponse.json({ id: memberId, role: newRole });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Member update error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId, memberId } = await params;

    if (!isWorkspaceAdmin(session, workspaceId)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const db = getDb();

    // Find the member
    const members = await db
      .select()
      .from(schema.workspace_members)
      .where(
        and(
          eq(schema.workspace_members.id, memberId),
          eq(schema.workspace_members.workspace_id, workspaceId)
        )
      )
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        { error: "Member not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const member = members[0];

    // Prevent removing the last admin
    if (member.role === "admin") {
      const adminCount = await db
        .select()
        .from(schema.workspace_members)
        .where(
          and(
            eq(schema.workspace_members.workspace_id, workspaceId),
            eq(schema.workspace_members.role, "admin")
          )
        );

      if (adminCount.length <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin", code: "LAST_ADMIN" },
          { status: 400 }
        );
      }
    }

    await db
      .delete(schema.workspace_members)
      .where(eq(schema.workspace_members.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Member remove error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

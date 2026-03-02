import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, isWorkspaceAdmin, WorkspaceAuthError } from "@/lib/workspace-auth";
import { memberInviteSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId } = await params;

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();
    const members = await db
      .select({
        id: schema.workspace_members.id,
        workspace_id: schema.workspace_members.workspace_id,
        user_id: schema.workspace_members.user_id,
        role: schema.workspace_members.role,
        created_at: schema.workspace_members.created_at,
        user_email: schema.users.email,
        user_name: schema.users.name,
        user_avatar_url: schema.users.avatar_url,
      })
      .from(schema.workspace_members)
      .innerJoin(schema.users, eq(schema.workspace_members.user_id, schema.users.id))
      .where(eq(schema.workspace_members.workspace_id, workspaceId));

    const result = members.map((m) => ({
      id: m.id,
      workspace_id: m.workspace_id,
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      user: {
        id: m.user_id,
        email: m.user_email,
        name: m.user_name,
        avatar_url: m.user_avatar_url,
      },
    }));

    return NextResponse.json({ members: result });
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
        { status: error.status }
      );
    }
    console.error("Members list error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId } = await params;

    if (!isWorkspaceAdmin(session, workspaceId)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = memberInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;
    const db = getDb();

    // Find user by email
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json(
        { error: "User not found. They must sign up first.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const targetUser = users[0];

    // Check if already a member
    const existing = await db
      .select()
      .from(schema.workspace_members)
      .where(
        and(
          eq(schema.workspace_members.workspace_id, workspaceId),
          eq(schema.workspace_members.user_id, targetUser.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "User is already a member", code: "ALREADY_MEMBER" },
        { status: 409 }
      );
    }

    const memberId = crypto.randomUUID();
    await db.insert(schema.workspace_members).values({
      id: memberId,
      workspace_id: workspaceId,
      user_id: targetUser.id,
      role,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      id: memberId,
      workspace_id: workspaceId,
      user_id: targetUser.id,
      role,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        avatar_url: targetUser.avatar_url,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Member invite error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

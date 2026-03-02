import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, isWorkspaceAdmin, WorkspaceAuthError } from "@/lib/workspace-auth";
import { memberInviteSchema, INVITATION_EXPIRY_DAYS } from "@glop/shared";

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

    // Also fetch pending invitations
    const invitations = await db
      .select({
        id: schema.workspace_invitations.id,
        workspace_id: schema.workspace_invitations.workspace_id,
        email: schema.workspace_invitations.email,
        role: schema.workspace_invitations.role,
        status: schema.workspace_invitations.status,
        invited_by: schema.workspace_invitations.invited_by,
        expires_at: schema.workspace_invitations.expires_at,
        created_at: schema.workspace_invitations.created_at,
        inviter_email: schema.users.email,
        inviter_name: schema.users.name,
      })
      .from(schema.workspace_invitations)
      .innerJoin(schema.users, eq(schema.workspace_invitations.invited_by, schema.users.id))
      .where(
        and(
          eq(schema.workspace_invitations.workspace_id, workspaceId),
          eq(schema.workspace_invitations.status, "pending")
        )
      );

    const invitationResult = invitations.map((inv) => ({
      id: inv.id,
      workspace_id: inv.workspace_id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      invited_by: inv.invited_by,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
      inviter: {
        id: inv.invited_by,
        email: inv.inviter_email,
        name: inv.inviter_name,
      },
    }));

    return NextResponse.json({ members: result, invitations: invitationResult });
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

    if (users.length > 0) {
      // User exists — add directly as member
      const targetUser = users[0];

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
    }

    // User not found — create pending email invitation
    // Check for existing pending invitation
    const existingInvitation = await db
      .select()
      .from(schema.workspace_invitations)
      .where(
        and(
          eq(schema.workspace_invitations.workspace_id, workspaceId),
          eq(schema.workspace_invitations.email, email),
          eq(schema.workspace_invitations.status, "pending")
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email", code: "ALREADY_INVITED" },
        { status: 409 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invitationId = crypto.randomUUID();
    await db.insert(schema.workspace_invitations).values({
      id: invitationId,
      workspace_id: workspaceId,
      email,
      role,
      status: "pending",
      invited_by: session.user_id,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    });

    // Fetch inviter info for response
    const inviter = await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, session.user_id))
      .limit(1);

    return NextResponse.json({
      invitation: {
        id: invitationId,
        workspace_id: workspaceId,
        email,
        role,
        status: "pending",
        invited_by: session.user_id,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        inviter: inviter[0] ? {
          id: inviter[0].id,
          email: inviter[0].email,
          name: inviter[0].name,
        } : undefined,
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

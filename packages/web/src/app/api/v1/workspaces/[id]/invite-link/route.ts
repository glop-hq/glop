import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin } from "@/lib/workspace-auth";
import { inviteLinkCreateSchema, INVITE_LINK_TOKEN_BYTES } from "@glop/shared";

export const dynamic = "force-dynamic";

function buildInviteUrl(token: string, request: NextRequest): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/join/${token}`;
}

export async function GET(
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

    const db = getDb();
    const links = await db
      .select()
      .from(schema.workspace_invite_links)
      .where(eq(schema.workspace_invite_links.workspace_id, workspaceId))
      .limit(1);

    if (links.length === 0 || !links[0].enabled) {
      return NextResponse.json({ invite_link: null });
    }

    const link = links[0];
    return NextResponse.json({
      invite_link: {
        id: link.id,
        workspace_id: link.workspace_id,
        token: link.token,
        url: buildInviteUrl(link.token, request),
        role: link.role,
        enabled: link.enabled,
        created_at: link.created_at,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Get invite link error:", error);
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

    const body = await request.json().catch(() => ({}));
    const parsed = inviteLinkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { role } = parsed.data;
    const token = randomBytes(INVITE_LINK_TOKEN_BYTES).toString("hex");
    const now = new Date().toISOString();
    const db = getDb();

    // Upsert: delete existing link for this workspace, then insert new one
    await db
      .delete(schema.workspace_invite_links)
      .where(eq(schema.workspace_invite_links.workspace_id, workspaceId));

    const linkId = crypto.randomUUID();
    await db.insert(schema.workspace_invite_links).values({
      id: linkId,
      workspace_id: workspaceId,
      token,
      role,
      enabled: true,
      created_by: session.user_id,
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      invite_link: {
        id: linkId,
        workspace_id: workspaceId,
        token,
        url: buildInviteUrl(token, request),
        role,
        enabled: true,
        created_at: now,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Create invite link error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
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

    const db = getDb();
    await db
      .update(schema.workspace_invite_links)
      .set({ enabled: false, updated_at: new Date().toISOString() })
      .where(eq(schema.workspace_invite_links.workspace_id, workspaceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Disable invite link error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

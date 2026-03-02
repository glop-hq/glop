import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getDb();

    const links = await db
      .select({
        workspace_name: schema.workspaces.name,
        enabled: schema.workspace_invite_links.enabled,
      })
      .from(schema.workspace_invite_links)
      .innerJoin(
        schema.workspaces,
        eq(schema.workspace_invite_links.workspace_id, schema.workspaces.id)
      )
      .where(eq(schema.workspace_invite_links.token, token))
      .limit(1);

    if (links.length === 0 || !links[0].enabled) {
      return NextResponse.json(
        { error: "Invite link not found or disabled", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ workspace_name: links[0].workspace_name });
  } catch (error) {
    console.error("Get join info error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await requireSession();
    const { token } = await params;
    const db = getDb();

    // Look up the invite link
    const links = await db
      .select()
      .from(schema.workspace_invite_links)
      .where(eq(schema.workspace_invite_links.token, token))
      .limit(1);

    if (links.length === 0 || !links[0].enabled) {
      return NextResponse.json(
        { error: "Invite link not found or disabled", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const link = links[0];

    // Check not already a member
    const existing = await db
      .select({ id: schema.workspace_members.id })
      .from(schema.workspace_members)
      .where(
        and(
          eq(schema.workspace_members.workspace_id, link.workspace_id),
          eq(schema.workspace_members.user_id, session.user_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "You are already a member of this workspace", code: "ALREADY_MEMBER" },
        { status: 409 }
      );
    }

    // Add user to workspace
    await db.insert(schema.workspace_members).values({
      id: crypto.randomUUID(),
      workspace_id: link.workspace_id,
      user_id: session.user_id,
      role: link.role,
      created_at: new Date().toISOString(),
    });

    // Get workspace name for response
    const workspaces = await db
      .select({ name: schema.workspaces.name })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, link.workspace_id))
      .limit(1);

    return NextResponse.json({
      workspace_id: link.workspace_id,
      workspace_name: workspaces[0]?.name || "Workspace",
      role: link.role,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Join workspace error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

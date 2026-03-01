import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const db = getDb();

    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.user_id))
      .limit(1);

    if (users.length === 0) {
      return NextResponse.json(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const user = users[0];

    const memberships = await db
      .select({
        workspace_id: schema.workspace_members.workspace_id,
        role: schema.workspace_members.role,
        id: schema.workspaces.id,
        name: schema.workspaces.name,
        slug: schema.workspaces.slug,
        created_by: schema.workspaces.created_by,
        created_at: schema.workspaces.created_at,
        updated_at: schema.workspaces.updated_at,
      })
      .from(schema.workspace_members)
      .innerJoin(
        schema.workspaces,
        eq(schema.workspace_members.workspace_id, schema.workspaces.id)
      )
      .where(eq(schema.workspace_members.user_id, session.user_id));

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        provider: user.provider,
        created_at: user.created_at,
      },
      workspaces: memberships.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        created_by: m.created_by,
        created_at: m.created_at,
        updated_at: m.updated_at,
      })),
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

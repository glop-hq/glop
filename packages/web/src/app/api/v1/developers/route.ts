import { NextRequest, NextResponse } from "next/server";
import { eq, sql, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = request.nextUrl.searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();

    const developers = await db
      .select({
        id: schema.developers.id,
        workspace_id: schema.developers.workspace_id,
        display_name: schema.developers.display_name,
        email: schema.developers.email,
        identity_keys: schema.developers.identity_keys,
        avatar_url: schema.developers.avatar_url,
        first_seen_at: schema.developers.first_seen_at,
        last_active_at: schema.developers.last_active_at,
        created_at: schema.developers.created_at,
        updated_at: schema.developers.updated_at,
        run_count: sql<number>`count(${schema.runs.id})::int`,
      })
      .from(schema.developers)
      .leftJoin(
        schema.runs,
        eq(schema.runs.developer_entity_id, schema.developers.id)
      )
      .where(eq(schema.developers.workspace_id, workspaceId))
      .groupBy(schema.developers.id)
      .orderBy(desc(schema.developers.last_active_at));

    return NextResponse.json({ data: developers });
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
    console.error("GET /api/v1/developers error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

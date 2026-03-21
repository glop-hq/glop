import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  isWorkspaceAdmin,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { developerUpdateSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: developerId } = await params;

    const db = getDb();

    const [developer] = await db
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
      .where(eq(schema.developers.id, developerId))
      .groupBy(schema.developers.id)
      .limit(1);

    if (!developer) {
      return NextResponse.json(
        { error: "Developer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, developer.workspace_id);

    return NextResponse.json({ data: developer });
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
    console.error("GET /api/v1/developers/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: developerId } = await params;

    const db = getDb();

    const [developer] = await db
      .select()
      .from(schema.developers)
      .where(eq(schema.developers.id, developerId))
      .limit(1);

    if (!developer) {
      return NextResponse.json(
        { error: "Developer not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, developer.workspace_id);

    if (!isWorkspaceAdmin(session, developer.workspace_id)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = developerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(schema.developers)
      .set({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.developers.id, developerId))
      .returning();

    return NextResponse.json({ data: updated });
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
    console.error("PUT /api/v1/developers/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

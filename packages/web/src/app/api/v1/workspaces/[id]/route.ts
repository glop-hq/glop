import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin } from "@/lib/workspace-auth";
import { workspaceUpdateSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function PATCH(
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
    const parsed = workspaceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const db = getDb();
    const updated = await db
      .update(schema.workspaces)
      .set({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.workspaces.id, workspaceId))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "Workspace not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ workspace: updated[0] });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Workspace update error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

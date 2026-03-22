import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { frictionStatusUpdateSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();

    const parsed = frictionStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id, status } = parsed.data;
    requireWorkspaceMember(session, workspace_id);

    const db = getDb();
    const now = new Date().toISOString();

    const [updated] = await db
      .update(schema.friction_insights)
      .set({
        status,
        resolved_at: status === "resolved" ? now : null,
        updated_at: now,
      })
      .where(
        and(
          eq(schema.friction_insights.id, id),
          eq(schema.friction_insights.workspace_id, workspace_id)
        )
      )
      .returning({ id: schema.friction_insights.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Friction insight not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: updated.id, status });
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
    console.error("Friction update error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { suggestionStatusUpdateSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/suggestions/{id} — Update suggestion status (accept or dismiss).
 * Authenticated via session.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: suggestionId } = await params;
    const db = getDb();

    const body = await request.json();
    const parsed = suggestionStatusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid update data",
          code: "INVALID_INPUT",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    // Fetch the suggestion to check workspace membership
    const [suggestion] = await db
      .select()
      .from(schema.standard_suggestions)
      .where(eq(schema.standard_suggestions.id, suggestionId))
      .limit(1);

    if (!suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, suggestion.workspace_id);

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: now,
    };

    if (parsed.data.status === "accepted") {
      updateData.accepted_at = now;
    } else if (parsed.data.status === "dismissed") {
      updateData.dismissed_at = now;
      if (parsed.data.dismiss_reason) {
        updateData.dismiss_reason = parsed.data.dismiss_reason;
      }
    }

    const [updated] = await db
      .update(schema.standard_suggestions)
      .set(updateData)
      .where(eq(schema.standard_suggestions.id, suggestionId))
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
    console.error("PUT /api/v1/suggestions/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

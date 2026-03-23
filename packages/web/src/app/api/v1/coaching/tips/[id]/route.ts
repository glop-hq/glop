import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { validateApiKey } from "@/lib/auth";
import { coachingTipUpdateSchema } from "@glop/shared/validation";

export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/coaching/tips/[id] — Update a coaching tip's status.
 * Supports both session auth (dashboard) and API key auth (CLI).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const body = await request.json();
    const parsed = coachingTipUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Fetch the tip first
    const tips = await db
      .select()
      .from(schema.coaching_tips)
      .where(eq(schema.coaching_tips.id, id))
      .limit(1);

    if (tips.length === 0) {
      return NextResponse.json(
        { error: "Tip not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const tip = tips[0];

    // Auth check
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.slice(7);
      const authInfo = await validateApiKey(db, apiKey);
      if (!authInfo) {
        return NextResponse.json(
          { error: "Invalid API key", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    } else {
      const session = await requireSession();
      requireWorkspaceMember(session, tip.workspace_id);
    }

    const { status, dismiss_reason } = parsed.data;
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { status };

    if (status === "delivered") {
      updateData.delivered_at = now;
    } else if (status === "engaged") {
      updateData.engaged_at = now;
    } else if (status === "dismissed") {
      updateData.dismissed_at = now;
      if (dismiss_reason) {
        updateData.dismiss_reason = dismiss_reason;
      }
    }

    await db
      .update(schema.coaching_tips)
      .set(updateData)
      .where(eq(schema.coaching_tips.id, id));

    return NextResponse.json({ data: { id, ...updateData } });
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
    console.error("PUT /api/v1/coaching/tips/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

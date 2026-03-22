import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { digestSettingsSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const sp = request.nextUrl.searchParams;
    const workspace_id = sp.get("workspace_id");
    if (!workspace_id) {
      return NextResponse.json(
        { error: "workspace_id required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    requireWorkspaceMember(session, workspace_id);

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.digest_schedules)
      .where(
        and(
          eq(schema.digest_schedules.user_id, session.user_id),
          eq(schema.digest_schedules.workspace_id, workspace_id)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({
        schedule: null,
      });
    }

    const row = rows[0];
    return NextResponse.json({
      schedule: {
        id: row.id,
        frequency: row.frequency,
        enabled: row.enabled,
        last_sent_at: row.last_sent_at,
      },
    });
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
    console.error("Digest GET error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    const parsed = digestSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { workspace_id, frequency, enabled } = parsed.data;
    requireWorkspaceMember(session, workspace_id);

    const db = getDb();
    const now = new Date().toISOString();

    const [result] = await db
      .insert(schema.digest_schedules)
      .values({
        user_id: session.user_id,
        workspace_id,
        frequency,
        enabled,
        created_at: now,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.digest_schedules.user_id,
          schema.digest_schedules.workspace_id,
        ],
        set: {
          frequency,
          enabled,
          updated_at: now,
        },
      })
      .returning();

    return NextResponse.json({
      schedule: {
        id: result.id,
        frequency: result.frequency,
        enabled: result.enabled,
        last_sent_at: result.last_sent_at,
      },
    });
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
    console.error("Digest PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

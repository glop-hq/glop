import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  isWorkspaceAdmin,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { developerMergeSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const parsed = developerMergeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { source_id, target_id } = parsed.data;

    if (source_id === target_id) {
      return NextResponse.json(
        { error: "Cannot merge a developer with itself", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Fetch both developers
    const [source, target] = await Promise.all([
      db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.id, source_id))
        .limit(1)
        .then((r) => r[0]),
      db
        .select()
        .from(schema.developers)
        .where(eq(schema.developers.id, target_id))
        .limit(1)
        .then((r) => r[0]),
    ]);

    if (!source || !target) {
      return NextResponse.json(
        { error: "One or both developers not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (source.workspace_id !== target.workspace_id) {
      return NextResponse.json(
        { error: "Developers must be in the same workspace", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, target.workspace_id);

    if (!isWorkspaceAdmin(session, target.workspace_id)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    // Merge identity_keys (union)
    const mergedKeys = [
      ...new Set([...target.identity_keys, ...source.identity_keys]),
    ];

    // Pick earlier first_seen_at and later last_active_at
    const firstSeen =
      source.first_seen_at < target.first_seen_at
        ? source.first_seen_at
        : target.first_seen_at;
    const lastActive =
      source.last_active_at > target.last_active_at
        ? source.last_active_at
        : target.last_active_at;

    // Run all merge operations in a transaction
    const updated = await db.transaction(async (tx) => {
      // Move all runs from source to target
      await tx
        .update(schema.runs)
        .set({ developer_entity_id: target_id })
        .where(eq(schema.runs.developer_entity_id, source_id));

      // Update target with merged data
      const [result] = await tx
        .update(schema.developers)
        .set({
          identity_keys: mergedKeys,
          first_seen_at: firstSeen,
          last_active_at: lastActive,
          ...(!target.email && source.email ? { email: source.email } : {}),
          ...(!target.display_name && source.display_name
            ? { display_name: source.display_name }
            : {}),
          ...(!target.avatar_url && source.avatar_url
            ? { avatar_url: source.avatar_url }
            : {}),
          updated_at: now,
        })
        .where(eq(schema.developers.id, target_id))
        .returning();

      // Delete source developer
      await tx
        .delete(schema.developers)
        .where(eq(schema.developers.id, source_id));

      return result;
    });

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
    console.error("POST /api/v1/developers/merge error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

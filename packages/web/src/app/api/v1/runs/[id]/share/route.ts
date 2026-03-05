import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin } from "@/lib/workspace-auth";
import { shareRunSchema, DEFAULT_SHARE_EXPIRY_DAYS } from "@glop/shared";
import type { Run, ShareRunResponse } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: runId } = await params;

    const body = await request.json();
    const parsed = shareRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { action, expires_in_days } = parsed.data;
    const db = getDb();

    // Fetch the run
    const runs = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return NextResponse.json(
        { error: "Run not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const run = runs[0] as unknown as Run;

    // Must be run owner or workspace admin
    const isOwner = run.owner_user_id === session.user_id;
    const isAdmin = isWorkspaceAdmin(session, run.workspace_id);
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Only the run owner or workspace admin can share", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    if (action === "share_workspace") {
      await db
        .update(schema.runs)
        .set({ visibility: "workspace", updated_at: now })
        .where(eq(schema.runs.id, runId));

      const resp: ShareRunResponse = {
        visibility: "workspace",
        shared_link_active: run.shared_link_state === "active",
        ...(run.shared_link_expires_at ? { shared_link_expires_at: run.shared_link_expires_at } : {}),
      };
      return NextResponse.json(resp);
    }

    if (action === "unshare_workspace") {
      await db
        .update(schema.runs)
        .set({ visibility: "private", updated_at: now })
        .where(eq(schema.runs.id, runId));

      const resp: ShareRunResponse = {
        visibility: "private",
        shared_link_active: run.shared_link_state === "active",
        ...(run.shared_link_expires_at ? { shared_link_expires_at: run.shared_link_expires_at } : {}),
      };
      return NextResponse.json(resp);
    }

    if (action === "create_link") {
      const baseUrl = request.headers.get("x-forwarded-proto")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
        : new URL(request.url).origin;

      const sharedLinkUrl = `${baseUrl}/shared/runs/${runId}`;

      // Reactivate existing revoked link
      if (run.shared_link_state === "revoked") {
        await db
          .update(schema.runs)
          .set({ shared_link_state: "active", updated_at: now })
          .where(eq(schema.runs.id, runId));

        const resp: ShareRunResponse = {
          visibility: run.visibility === "workspace" ? "workspace" : "private",
          shared_link_active: true,
          shared_link_url: sharedLinkUrl,
          shared_link_expires_at: run.shared_link_expires_at ?? undefined,
        };
        return NextResponse.json(resp);
      }

      // First-time creation
      const expiryDays = expires_in_days || DEFAULT_SHARE_EXPIRY_DAYS;
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

      await db
        .update(schema.runs)
        .set({
          shared_link_state: "active",
          shared_link_expires_at: expiresAt,
          share_created_at: now,
          updated_at: now,
        })
        .where(eq(schema.runs.id, runId));

      const resp: ShareRunResponse = {
        visibility: run.visibility === "workspace" ? "workspace" : "private",
        shared_link_active: true,
        shared_link_url: sharedLinkUrl,
        shared_link_expires_at: expiresAt,
      };
      return NextResponse.json(resp);
    }

    // action === "revoke_link"
    await db
      .update(schema.runs)
      .set({
        shared_link_state: "revoked",
        updated_at: now,
      })
      .where(eq(schema.runs.id, runId));

    const resp: ShareRunResponse = {
      visibility: run.visibility === "workspace" ? "workspace" : "private",
      shared_link_active: false,
    };
    return NextResponse.json(resp);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Share error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

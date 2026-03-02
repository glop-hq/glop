import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin } from "@/lib/workspace-auth";
import { shareRunSchema, DEFAULT_SHARE_EXPIRY_DAYS } from "@glop/shared";
import { generateShareToken, buildShareUrl } from "@/lib/share-tokens";
import type { Run } from "@glop/shared";

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

    const { visibility, expires_in_days } = parsed.data;
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

    if (visibility === "workspace") {
      await db
        .update(schema.runs)
        .set({
          visibility: "workspace",
          shared_link_token_hash: null,
          shared_link_state: null,
          shared_link_expires_at: null,
          shared_link_id: null,
          share_created_at: now,
          updated_at: now,
        })
        .where(eq(schema.runs.id, runId));

      return NextResponse.json({ visibility: "workspace" });
    }

    if (visibility === "shared_link") {
      const { token, hash } = generateShareToken();
      const expiryDays = expires_in_days || DEFAULT_SHARE_EXPIRY_DAYS;
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const shareId = crypto.randomUUID();

      const baseUrl = request.headers.get("x-forwarded-proto")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
        : new URL(request.url).origin;

      const sharedLinkUrl = buildShareUrl(baseUrl, runId, token);

      await db
        .update(schema.runs)
        .set({
          visibility: "shared_link",
          shared_link_id: shareId,
          shared_link_token_hash: hash,
          shared_link_state: "active",
          shared_link_expires_at: expiresAt,
          share_created_at: now,
          updated_at: now,
        })
        .where(eq(schema.runs.id, runId));

      return NextResponse.json({
        visibility: "shared_link",
        shared_link_url: sharedLinkUrl,
        expires_at: expiresAt,
      });
    }

    // visibility === "private"
    await db
      .update(schema.runs)
      .set({
        visibility: "private",
        shared_link_token_hash: null,
        shared_link_state: null,
        shared_link_expires_at: null,
        shared_link_id: null,
        share_created_at: null,
        updated_at: now,
      })
      .where(eq(schema.runs.id, runId));

    return NextResponse.json({ visibility: "private" });
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: runId } = await params;
    const db = getDb();

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
    const isOwner = run.owner_user_id === session.user_id;
    const isAdmin = isWorkspaceAdmin(session, run.workspace_id);
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Only the run owner or workspace admin can revoke", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    await db
      .update(schema.runs)
      .set({
        visibility: "private",
        shared_link_state: run.shared_link_state ? "revoked" : null,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.runs.id, runId));

    return NextResponse.json({ visibility: "private" });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Revoke share error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

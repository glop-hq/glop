import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { validateApiKey } from "@/lib/auth";
import { coachingTipQuerySchema } from "@glop/shared/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/coaching/tips — Get coaching tips for a developer.
 * Supports both session auth (dashboard) and API key auth (CLI).
 * Query params: workspace_id (required), developer_id, repo_key, channel, status
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = coachingTipQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { workspace_id, developer_id, repo_key, channel, status } = parsed.data;

    // Dual auth: API key for CLI, session for dashboard
    const authHeader = request.headers.get("authorization");
    let resolvedDeveloperId = developer_id;

    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.slice(7);
      const authInfo = await validateApiKey(db, apiKey);
      if (!authInfo) {
        return NextResponse.json(
          { error: "Invalid API key", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
      // For CLI, resolve developer entity by identity_keys containment
      if (!resolvedDeveloperId) {
        const devEntity = await db
          .select({ id: schema.developers.id })
          .from(schema.developers)
          .where(
            and(
              eq(schema.developers.workspace_id, workspace_id),
              sql`${schema.developers.identity_keys} @> ${JSON.stringify([authInfo.developer_id])}::jsonb`
            )
          )
          .limit(1);
        if (devEntity.length > 0) {
          resolvedDeveloperId = devEntity[0].id;
        }
      }
    } else {
      const session = await requireSession();
      requireWorkspaceMember(session, workspace_id);
    }

    // Build conditions
    const conditions = [
      eq(schema.coaching_tips.workspace_id, workspace_id),
      gte(schema.coaching_tips.expires_at, new Date().toISOString()),
    ];

    if (resolvedDeveloperId) {
      conditions.push(eq(schema.coaching_tips.developer_id, resolvedDeveloperId));
    }

    if (status) {
      conditions.push(eq(schema.coaching_tips.status, status));
    } else if (channel === "cli") {
      // CLI: only undelivered tips
      conditions.push(eq(schema.coaching_tips.status, "active"));
    } else {
      conditions.push(inArray(schema.coaching_tips.status, ["active", "delivered"]));
    }

    // If repo_key provided, resolve to repo_id
    if (repo_key) {
      const repo = await db
        .select({ id: schema.repos.id })
        .from(schema.repos)
        .where(
          and(
            eq(schema.repos.workspace_id, workspace_id),
            eq(schema.repos.repo_key, repo_key)
          )
        )
        .limit(1);
      if (repo.length > 0) {
        conditions.push(eq(schema.coaching_tips.repo_id, repo[0].id));
      }
    }

    const limit = channel === "cli" ? 1 : 10;

    const tips = await db
      .select({
        id: schema.coaching_tips.id,
        developer_id: schema.coaching_tips.developer_id,
        repo_id: schema.coaching_tips.repo_id,
        workspace_id: schema.coaching_tips.workspace_id,
        source_type: schema.coaching_tips.source_type,
        source_id: schema.coaching_tips.source_id,
        title: schema.coaching_tips.title,
        body: schema.coaching_tips.body,
        action_type: schema.coaching_tips.action_type,
        action_payload: schema.coaching_tips.action_payload,
        priority: schema.coaching_tips.priority,
        status: schema.coaching_tips.status,
        delivered_via: schema.coaching_tips.delivered_via,
        delivered_at: schema.coaching_tips.delivered_at,
        engaged_at: schema.coaching_tips.engaged_at,
        dismissed_at: schema.coaching_tips.dismissed_at,
        dismiss_reason: schema.coaching_tips.dismiss_reason,
        expires_at: schema.coaching_tips.expires_at,
        created_at: schema.coaching_tips.created_at,
        repo_key: schema.repos.repo_key,
        repo_display_name: schema.repos.display_name,
      })
      .from(schema.coaching_tips)
      .leftJoin(schema.repos, eq(schema.coaching_tips.repo_id, schema.repos.id))
      .where(and(...conditions))
      .orderBy(desc(schema.coaching_tips.created_at))
      .limit(limit);

    // For CLI channel, mark as delivered
    if (channel === "cli" && tips.length > 0 && tips[0].status === "active") {
      await db
        .update(schema.coaching_tips)
        .set({
          status: "delivered",
          delivered_via: "cli",
          delivered_at: new Date().toISOString(),
        })
        .where(eq(schema.coaching_tips.id, tips[0].id));

      tips[0].status = "delivered";
      tips[0].delivered_via = "cli";
    }

    return NextResponse.json({ data: tips });
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
    console.error("GET /api/v1/coaching/tips error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

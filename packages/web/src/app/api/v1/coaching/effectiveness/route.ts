import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/coaching/effectiveness — Coaching effectiveness metrics.
 * Query params: workspace_id (required)
 * Authenticated via session.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspaceId = request.nextUrl.searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_id is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();

    const statusCounts = await db
      .select({
        status: schema.coaching_tips.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.coaching_tips)
      .where(eq(schema.coaching_tips.workspace_id, workspaceId))
      .groupBy(schema.coaching_tips.status);

    const counts: Record<string, number> = {};
    for (const row of statusCounts) {
      counts[row.status] = row.count;
    }

    const delivered = (counts.delivered ?? 0) + (counts.engaged ?? 0) + (counts.dismissed ?? 0);
    const engaged = counts.engaged ?? 0;
    const dismissed = counts.dismissed ?? 0;
    const total = delivered > 0 ? delivered : 1;

    return NextResponse.json({
      data: {
        tips_delivered: delivered,
        tips_engaged: engaged,
        tips_dismissed: dismissed,
        tips_active: counts.active ?? 0,
        tips_expired: counts.expired ?? 0,
        engagement_rate: Math.round((engaged / total) * 100),
        dismissal_rate: Math.round((dismissed / total) * 100),
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
    console.error("GET /api/v1/coaching/effectiveness error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

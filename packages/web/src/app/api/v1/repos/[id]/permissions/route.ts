import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import type { PermissionRecommendationsResponse } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: repoId } = await params;
    const db = getDb();

    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, repoId))
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, repo.workspace_id);

    const recommendations = await db
      .select()
      .from(schema.permission_recommendations)
      .where(eq(schema.permission_recommendations.repo_id, repoId))
      .orderBy(
        desc(schema.permission_recommendations.frequency)
      );

    const autoAllowRecs = recommendations.filter((r) => r.tier === "auto_allow");
    const totalSavings = autoAllowRecs.reduce(
      (sum, r) => sum + r.est_time_saved_sec,
      0
    );

    const response: PermissionRecommendationsResponse = {
      recommendations: recommendations.map((r) => ({
        id: r.id,
        pattern: r.pattern,
        tier: r.tier as PermissionRecommendationsResponse["recommendations"][0]["tier"],
        approval_rate: r.approval_rate,
        frequency: r.frequency,
        developer_consensus: r.developer_consensus,
        est_time_saved_sec: r.est_time_saved_sec,
      })),
      summary: {
        total_patterns: recommendations.length,
        auto_allow_count: autoAllowRecs.length,
        est_weekly_savings_sec: totalSavings,
      },
    };

    return NextResponse.json({ data: response });
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
    console.error("GET /api/v1/repos/[id]/permissions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

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

    const allRecs = await db
      .select()
      .from(schema.permission_recommendations)
      .where(eq(schema.permission_recommendations.repo_id, repoId));

    const autoAllow = allRecs.filter((r) => r.tier === "auto_allow");
    const weeklySavingsSec = autoAllow.reduce(
      (sum, r) => sum + r.est_time_saved_sec,
      0
    );
    const promptsEliminated = autoAllow.reduce(
      (sum, r) => sum + Math.round(r.frequency / 4.3),
      0
    );

    const minutes = Math.round(weeklySavingsSec / 60);
    const display =
      minutes >= 60
        ? `${Math.round(minutes / 60)}h ${minutes % 60}m`
        : `${minutes} min`;

    return NextResponse.json({
      data: {
        weekly_savings_sec: weeklySavingsSec,
        weekly_savings_display: display,
        prompts_eliminated: promptsEliminated,
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
    console.error("GET /api/v1/repos/[id]/permissions/savings error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

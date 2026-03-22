import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { requireSession, AuthError } from "@/lib/session";
import { requireWorkspaceMember, WorkspaceAuthError } from "@/lib/workspace-auth";
import { repoInsightSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/repos/insights — Submit repo-level insight from CLI.
 * Authenticated via API key (Bearer token).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const db = getDb();
    const auth = await validateApiKey(db, apiKey);

    if (!auth) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = repoInsightSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid insight data", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { workspace_id, repo_key, ...insightData } = parsed.data;

    // Look up repo
    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.workspace_id, workspace_id),
          eq(schema.repos.repo_key, repo_key)
        )
      )
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const [insight] = await db
      .insert(schema.repo_insights)
      .values({
        repo_id: repo.id,
        workspace_id,
        period_start: insightData.period_start,
        period_end: insightData.period_end,
        session_count: insightData.session_count,
        developer_count: insightData.developer_count,
        outcome_distribution: insightData.outcome_distribution,
        friction_analysis: insightData.friction_analysis,
        success_patterns: insightData.success_patterns,
        claude_md_suggestions: insightData.claude_md_suggestions,
        file_coupling: insightData.file_coupling,
        area_complexity: insightData.area_complexity,
        generated_by: auth.developer_id,
      })
      .returning();

    return NextResponse.json({ data: { id: insight.id } });
  } catch (error) {
    console.error("POST /api/v1/repos/insights error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/repos/insights — Get latest repo insight.
 * Query param: repo_id (required), workspace_id (required).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const params = request.nextUrl.searchParams;
    const workspaceId = params.get("workspace_id");
    const repoId = params.get("repo_id");

    if (!workspaceId || !repoId) {
      return NextResponse.json(
        { error: "workspace_id and repo_id are required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();

    const [insight] = await db
      .select()
      .from(schema.repo_insights)
      .where(
        and(
          eq(schema.repo_insights.repo_id, repoId),
          eq(schema.repo_insights.workspace_id, workspaceId)
        )
      )
      .orderBy(desc(schema.repo_insights.created_at))
      .limit(1);

    return NextResponse.json({ data: insight || null });
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
    console.error("GET /api/v1/repos/insights error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

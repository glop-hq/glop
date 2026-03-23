import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/repos/context-recommendation?workspace_id=X&repo_key=Y
 * Returns session length recommendation for a repo, if one exists.
 * Authenticated via API key (Bearer token).
 */
export async function GET(request: NextRequest) {
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

    const sp = request.nextUrl.searchParams;
    const workspaceId = sp.get("workspace_id");
    const repoKey = sp.get("repo_key");

    if (!workspaceId || !repoKey) {
      return NextResponse.json(
        { error: "workspace_id and repo_key are required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Look up repo
    const [repo] = await db
      .select({ id: schema.repos.id })
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.workspace_id, workspaceId),
          eq(schema.repos.repo_key, repoKey)
        )
      )
      .limit(1);

    if (!repo) {
      return NextResponse.json({ data: null });
    }

    // Look up recommendation
    const [rec] = await db
      .select()
      .from(schema.repo_context_recommendations)
      .where(eq(schema.repo_context_recommendations.repo_id, repo.id))
      .limit(1);

    if (!rec) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        recommended_max_duration_min: rec.recommended_max_duration_min,
        confidence: rec.confidence,
        sample_size: rec.sample_size,
        reasoning: rec.reasoning,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/repos/context-recommendation error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

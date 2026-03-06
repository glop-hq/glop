import { NextRequest, NextResponse } from "next/server";
import { desc, inArray, and, or, sql, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { historyQuerySchema } from "@glop/shared";
import { requireSession, AuthError } from "@/lib/session";
import type { ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const rawOffset = searchParams.get("offset");
    const rawLimit = searchParams.get("limit");
    const parsed = historyQuerySchema.safeParse({
      offset: rawOffset ?? undefined,
      limit: rawLimit ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const { offset, limit } = parsed.data;
    const db = getDb();

    const allWorkspaceIds = session.workspaces.map((w) => w.id);
    if (allWorkspaceIds.length === 0) {
      return NextResponse.json({ runs: [], total: 0, offset, limit });
    }

    // Scope to a single workspace if requested, otherwise all
    const requestedId = searchParams.get("workspace_id");
    const workspaceIds =
      requestedId && allWorkspaceIds.includes(requestedId)
        ? [requestedId]
        : allWorkspaceIds;

    // Show workspace-shared runs from anyone + all of my own runs
    const statusFilter = and(
      inArray(schema.runs.status, ["completed", "failed"]),
      inArray(schema.runs.workspace_id, workspaceIds),
      sql`${schema.runs.owner_user_id} IS NOT NULL`,
      or(
        eq(schema.runs.visibility, "workspace"),
        eq(schema.runs.owner_user_id, session.user_id),
      ),
    );

    const runs = await db
      .select()
      .from(schema.runs)
      .where(statusFilter)
      .orderBy(desc(schema.runs.completed_at))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.runs)
      .where(statusFilter);

    const total = countResult[0]?.count || 0;

    // Get artifacts for runs
    const runIds = runs.map((r) => r.id);
    let artifacts: ArtifactInfo[] = [];

    if (runIds.length > 0) {
      const rawArtifacts = await db
        .select()
        .from(schema.artifacts)
        .where(inArray(schema.artifacts.run_id, runIds));

      artifacts = rawArtifacts as ArtifactInfo[];
    }

    const runsWithArtifacts = runs.map((run) => ({
      ...run,
      artifacts: artifacts.filter((a) => a.run_id === run.id),
    }));

    return NextResponse.json({
      runs: runsWithArtifacts,
      total,
      offset,
      limit,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("History error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { historyQuerySchema } from "@glop/shared";
import type { ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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

    const runs = await db
      .select()
      .from(schema.runs)
      .where(inArray(schema.runs.status, ["completed", "failed"]))
      .orderBy(desc(schema.runs.completed_at))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.runs)
      .where(inArray(schema.runs.status, ["completed", "failed"]));

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
    console.error("History error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

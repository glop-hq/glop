import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, gte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/repos/{id}/prompts — Fetch recent developer prompt texts for a repo.
 * Used by the CLI during suggestion generation.
 * Authenticated via API key (Bearer token).
 * Query params: since (ISO date, optional), limit (default 1000, max 1000)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: repoId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get("since");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "1000", 10) || 1000,
      1000
    );

    // Verify repo exists
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

    // Query run.prompt events for this repo's runs
    const conditions = [
      eq(schema.events.event_type, "run.prompt"),
      eq(schema.runs.repo_id, repoId),
    ];

    if (since) {
      conditions.push(gte(schema.events.occurred_at, since));
    }

    const events = await db
      .select({
        content: schema.events.payload,
        occurred_at: schema.events.occurred_at,
      })
      .from(schema.events)
      .innerJoin(schema.runs, eq(schema.events.run_id, schema.runs.id))
      .where(and(...conditions))
      .orderBy(desc(schema.events.occurred_at))
      .limit(limit);

    // Extract prompt text from payload, truncate each to 500 chars
    const prompts = events
      .map((e) => {
        const payload = e.content as Record<string, unknown>;
        const text =
          typeof payload.content === "string" ? payload.content : null;
        if (!text) return null;
        return text.length > 500 ? text.slice(0, 500) + "..." : text;
      })
      .filter(Boolean) as string[];

    return NextResponse.json({
      data: { prompts, count: prompts.length },
    });
  } catch (error) {
    console.error("GET /api/v1/repos/[id]/prompts error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

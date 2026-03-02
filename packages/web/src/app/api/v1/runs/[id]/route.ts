import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { applyTimeBasedStatus } from "@/lib/stale-checker";
import { requireSession, AuthError } from "@/lib/session";
import { canViewRun, type Run, type Event, type ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const db = getDb();

    const runs = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, id))
      .limit(1);

    if (runs.length === 0) {
      return NextResponse.json(
        { error: "Run not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const [run] = applyTimeBasedStatus(runs as Run[]);

    // Access control: viewer must be owner or workspace member
    const viewerCtx = {
      viewer_user_id: session.user_id,
      viewer_workspace_ids: session.workspaces.map((w) => w.id),
    };
    if (!canViewRun(run, viewerCtx)) {
      return NextResponse.json(
        { error: "Access denied", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.run_id, id))
      .orderBy(asc(schema.events.occurred_at));

    const parsedEvents = events as Event[];

    const rawArtifacts = await db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.run_id, id));

    const artifacts = rawArtifacts as ArtifactInfo[];

    return NextResponse.json({
      run,
      events: parsedEvents,
      artifacts,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Run detail error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

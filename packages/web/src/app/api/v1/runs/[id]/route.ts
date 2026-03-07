import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { applyTimeBasedStatus } from "@/lib/stale-checker";
import { getSessionUser } from "@/lib/session";
import {
  canViewRun,
  redactEventPayload,
  type Run,
  type Event,
  type ArtifactInfo,
} from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
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

    // Access control: shared runs are public, otherwise require auth
    const viewerCtx = session
      ? {
          viewer_user_id: session.user_id,
          viewer_workspace_ids: session.workspaces.map((w) => w.id),
        }
      : null;

    if (!canViewRun(run, viewerCtx)) {
      if (!session) {
        return NextResponse.json(
          { error: "Authentication required", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
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

    const rawArtifacts = await db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.run_id, id));

    // Redact secrets for non-owners
    const isOwner = session && run.owner_user_id === session.user_id;
    const parsedEvents = isOwner
      ? (events as Event[])
      : (events as Event[]).map((event) => ({
          ...event,
          payload: redactEventPayload(event.payload),
        }));

    return NextResponse.json({
      run,
      events: parsedEvents,
      artifacts: rawArtifacts as ArtifactInfo[],
    });
  } catch (error) {
    console.error("Run detail error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

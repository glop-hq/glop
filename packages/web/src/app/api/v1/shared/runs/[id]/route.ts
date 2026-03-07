import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { redactEventPayload, type Run, type Event, type ArtifactInfo, type RunLink } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;

    const db = getDb();

    // Fetch the run
    const runs = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return NextResponse.json(
        { error: "Run not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const run = runs[0] as unknown as Run;

    // Validate share link is active
    if (run.shared_link_state !== "active") {
      return NextResponse.json(
        { error: "Share link is not active", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check expiry
    if (run.shared_link_expires_at) {
      const expiresAt = new Date(run.shared_link_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return NextResponse.json(
          { error: "Share link has expired", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
    }

    // Fetch events and artifacts
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.run_id, runId))
      .orderBy(asc(schema.events.occurred_at));

    const rawArtifacts = await db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.run_id, runId));

    // Redact secrets from event payloads
    const redactedEvents = (events as Event[]).map((event) => ({
      ...event,
      payload: redactEventPayload(event.payload),
    }));

    // Fetch parent run link
    let parent_run: RunLink | undefined;
    if (run.parent_run_id) {
      const [p] = await db
        .select({
          id: schema.runs.id,
          status: schema.runs.status,
          started_at: schema.runs.started_at,
        })
        .from(schema.runs)
        .where(eq(schema.runs.id, run.parent_run_id))
        .limit(1);
      if (p) parent_run = p as RunLink;
    }

    // Fetch child runs
    const childRows = await db
      .select({
        id: schema.runs.id,
        status: schema.runs.status,
        started_at: schema.runs.started_at,
      })
      .from(schema.runs)
      .where(eq(schema.runs.parent_run_id, runId))
      .orderBy(asc(schema.runs.created_at));
    const child_runs = childRows.length ? (childRows as RunLink[]) : undefined;

    return NextResponse.json({
      run,
      events: redactedEvents,
      artifacts: rawArtifacts as ArtifactInfo[],
      shared: true,
      parent_run,
      child_runs,
    });
  } catch (error) {
    console.error("Shared run error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

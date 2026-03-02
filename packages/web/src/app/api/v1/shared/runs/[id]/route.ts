import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { hashShareToken } from "@/lib/share-tokens";
import { redactEventPayload, type Run, type Event, type ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Share token required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const db = getDb();
    const tokenHash = hashShareToken(token);

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

    // Validate share link
    if (run.visibility !== "shared_link") {
      return NextResponse.json(
        { error: "Run is not shared", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (run.shared_link_state !== "active") {
      return NextResponse.json(
        { error: "Share link has been revoked", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (run.shared_link_token_hash !== tokenHash) {
      return NextResponse.json(
        { error: "Invalid share token", code: "UNAUTHORIZED" },
        { status: 401 }
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

    return NextResponse.json({
      run,
      events: redactedEvents,
      artifacts: rawArtifacts as ArtifactInfo[],
      shared: true,
    });
  } catch (error) {
    console.error("Shared run error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

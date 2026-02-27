import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { schema } from "@/lib/db";
import { applyTimeBasedStatus } from "@/lib/stale-checker";
import type { Run, Event, ArtifactInfo } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.run_id, id))
      .orderBy(asc(schema.events.occurred_at));

    const parsedEvents: Event[] = events.map((e) => ({
      ...e,
      payload: JSON.parse(e.payload || "{}"),
    })) as Event[];

    const rawArtifacts = await db
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.run_id, id));

    const artifacts: ArtifactInfo[] = rawArtifacts.map((a) => ({
      ...a,
      metadata: JSON.parse(a.metadata || "{}"),
    })) as ArtifactInfo[];

    return NextResponse.json({
      run,
      events: parsedEvents,
      artifacts,
    });
  } catch (error) {
    console.error("Run detail error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

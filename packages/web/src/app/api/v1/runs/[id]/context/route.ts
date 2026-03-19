import { NextRequest, NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

    const db = getDb();
    const auth = await validateApiKey(db, authHeader.slice(7));
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: runId } = await params;

    const [run] = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (!run) {
      return NextResponse.json(
        { error: "Run not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Ensure the run belongs to the same workspace
    if (run.workspace_id !== auth.workspace_id) {
      return NextResponse.json(
        { error: "Not authorized", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const events = await db
      .select({ payload: schema.events.payload })
      .from(schema.events)
      .where(eq(schema.events.run_id, runId))
      .orderBy(asc(schema.events.occurred_at));

    const prompts: string[] = [];
    const toolUseLabels: string[] = [];

    for (const event of events) {
      const payload = event.payload as Record<string, unknown>;
      if (payload.content_type === "prompt" && typeof payload.content === "string") {
        prompts.push(payload.content);
      }
      if (payload.content_type === "tool_use" && typeof payload.action_label === "string") {
        toolUseLabels.push(payload.action_label);
      }
    }

    return NextResponse.json({
      id: run.id,
      title: run.title,
      summary: run.summary,
      prompts: prompts.slice(0, 10),
      tool_use_labels: toolUseLabels.slice(0, 30),
      files_touched: run.files_touched,
      file_count: run.file_count,
      event_count: run.event_count,
    });
  } catch (error) {
    console.error("Run context error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

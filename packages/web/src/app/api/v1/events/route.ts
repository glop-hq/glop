import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { processHook, type HookContext } from "@/lib/event-processor";
import { ingestEventSchema } from "@glop/shared";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = ingestEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid event payload", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const machineId =
      request.headers.get("x-machine-id") || "unknown";

    const ctx: HookContext = {
      developer_id: auth.developer_id,
      developer_name: auth.developer_name,
      machine_id: machineId,
      repo_key: parsed.data.repo_key,
      branch_name: parsed.data.branch_name,
      git_user_name: null,
      git_user_email: null,
      workspace_id: auth.workspace_id,
    };

    const result = await processHook(
      db,
      "PostToolUse",
      { ...parsed.data.payload, event_type: parsed.data.event_type },
      ctx
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Event ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

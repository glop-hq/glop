import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { processHook, type HookContext } from "@/lib/event-processor";
import path from "path";

function extractRepoKey(cwd: string | undefined): string {
  if (!cwd) return "unknown";
  // Use last two path segments as repo key
  const parts = cwd.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return parts[parts.length - 1] || "unknown";
}

function extractBranch(payload: Record<string, unknown>): string {
  // Hook payload may include branch info
  if (typeof payload.branch === "string") return payload.branch;
  return "noname";
}

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

    // Determine hook type from payload
    // Claude Code sends hook_event_name, or hook_type, or we infer from context
    const hookType =
      body.hook_event_name || body.hook_type || (body.tool_name ? "PostToolUse" : "Stop");

    const machineId =
      typeof body.machine_id === "string"
        ? body.machine_id
        : request.headers.get("x-machine-id") || "unknown";

    const sessionId =
      typeof body.session_id === "string" ? body.session_id : undefined;

    const ctx: HookContext = {
      developer_id: auth.developer_id,
      developer_name: auth.developer_name,
      machine_id: machineId,
      repo_key:
        typeof body.repo_key === "string"
          ? body.repo_key
          : extractRepoKey(body.cwd),
      branch_name: extractBranch(body),
      session_id: sessionId,
    };

    const result = await processHook(db, hookType, body, ctx);

    if (!result.run_id) {
      return NextResponse.json(
        { message: "No active run to update" },
        { status: 200 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Hook ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

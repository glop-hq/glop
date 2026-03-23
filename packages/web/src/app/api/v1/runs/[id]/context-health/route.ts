import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { WorkspaceAuthError } from "@/lib/workspace-auth";
import type { RunContextHealth } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSession();
    const { id: runId } = await params;

    const db = getDb();

    const [row] = await db
      .select({
        run_id: schema.run_context_health.run_id,
        compaction_count: schema.run_context_health.compaction_count,
        first_compaction_at_min: schema.run_context_health.first_compaction_at_min,
        peak_utilization_pct: schema.run_context_health.peak_utilization_pct,
        end_utilization_pct: schema.run_context_health.end_utilization_pct,
        total_input_tokens: schema.run_context_health.total_input_tokens,
        total_output_tokens: schema.run_context_health.total_output_tokens,
        context_limit_tokens: schema.run_context_health.context_limit_tokens,
      })
      .from(schema.run_context_health)
      .where(eq(schema.run_context_health.run_id, runId))
      .limit(1);

    if (!row) {
      return NextResponse.json(
        { error: "Context health data not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const data: RunContextHealth = {
      run_id: row.run_id,
      compaction_count: row.compaction_count,
      first_compaction_at_min: row.first_compaction_at_min,
      peak_utilization_pct: row.peak_utilization_pct,
      end_utilization_pct: row.end_utilization_pct,
      total_input_tokens: row.total_input_tokens,
      total_output_tokens: row.total_output_tokens,
      context_limit_tokens: row.context_limit_tokens,
    };

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAuthError) {
      return NextResponse.json(
        { error: error.message, code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    console.error("Run context-health error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

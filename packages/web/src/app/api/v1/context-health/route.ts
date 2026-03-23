import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { contextHealthSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/context-health — Submit context health data for a run.
 * Authenticated via API key (Bearer token).
 */
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
    const parsed = contextHealthSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid context health data", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      workspace_id, repo_key, run_id, compaction_count, first_compaction_at_min,
      peak_utilization_pct, end_utilization_pct,
      total_input_tokens, total_output_tokens, context_limit_tokens,
    } = parsed.data;

    // Look up repo
    const [repo] = await db
      .select({ id: schema.repos.id })
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.workspace_id, workspace_id),
          eq(schema.repos.repo_key, repo_key)
        )
      )
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Upsert context health (unique on run_id)
    const tokenFields = {
      peak_utilization_pct: peak_utilization_pct ?? null,
      end_utilization_pct: end_utilization_pct ?? null,
      total_input_tokens: total_input_tokens ?? null,
      total_output_tokens: total_output_tokens ?? null,
      context_limit_tokens: context_limit_tokens ?? null,
    };

    const [row] = await db
      .insert(schema.run_context_health)
      .values({
        run_id,
        repo_id: repo.id,
        workspace_id,
        compaction_count,
        first_compaction_at_min: first_compaction_at_min ?? null,
        ...tokenFields,
      })
      .onConflictDoUpdate({
        target: schema.run_context_health.run_id,
        set: {
          // Token fields from transcript are authoritative — always overwrite
          ...tokenFields,
          // Use the higher compaction count (real-time events vs transcript heuristic)
          compaction_count: sql`GREATEST(${schema.run_context_health.compaction_count}, ${compaction_count})`,
          // Preserve real-time first_compaction_at_min if already set
          first_compaction_at_min: sql`COALESCE(${schema.run_context_health.first_compaction_at_min}, ${first_compaction_at_min ?? null})`,
        },
      })
      .returning({ id: schema.run_context_health.id });

    return NextResponse.json({ data: { id: row.id, run_id } });
  } catch (error) {
    console.error("POST /api/v1/context-health error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

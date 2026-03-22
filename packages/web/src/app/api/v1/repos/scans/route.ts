import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { scanResultSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/repos/scans — Receive scan results from CLI.
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
    const parsed = scanResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid scan result", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { workspace_id, repo_key, score, checks, claude_items, started_at, completed_at, error_message } =
      parsed.data;

    // Look up repo by (workspace_id, repo_key)
    const [repo] = await db
      .select()
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

    // Insert scan record
    const [scan] = await db
      .insert(schema.repo_scans)
      .values({
        repo_id: repo.id,
        workspace_id,
        score,
        status: error_message ? "error" : "completed",
        triggered_by: auth.developer_id,
        error_message: error_message || null,
        started_at,
        completed_at,
      })
      .returning();

    // Insert check records
    if (checks.length > 0) {
      await db.insert(schema.repo_scan_checks).values(
        checks.map((check) => ({
          scan_id: scan.id,
          check_id: check.check_id,
          status: check.status as "pass" | "warn" | "fail" | "skip",
          severity: check.severity as "critical" | "warning" | "info",
          weight: check.weight,
          score: check.score,
          title: check.title,
          description: check.description,
          recommendation: check.recommendation ?? null,
          fix_available: check.fix_available ?? false,
          details: check.details ?? {},
        }))
      );
    }

    // Replace claude_items for this repo
    await db
      .delete(schema.claude_items)
      .where(eq(schema.claude_items.repo_id, repo.id));

    if (claude_items.length > 0) {
      await db.insert(schema.claude_items).values(
        claude_items.map((item) => ({
          repo_id: repo.id,
          workspace_id,
          kind: item.kind as "skill" | "command",
          name: item.name,
          file_path: item.file_path,
          content: item.content,
        }))
      );
    }

    // Update repo.last_scanned_at
    await db
      .update(schema.repos)
      .set({
        last_scanned_at: completed_at,
        updated_at: new Date().toISOString(),
      })
      .where(eq(schema.repos.id, repo.id));

    return NextResponse.json({ data: { id: scan.id, score: scan.score, status: scan.status } });
  } catch (error) {
    console.error("POST /api/v1/repos/scans error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";
import { standardSuggestionSubmitSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/repos/{id}/suggestions — Submit generated suggestions from CLI.
 * Authenticated via API key (Bearer token).
 */
export async function POST(
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

    const apiKey = authHeader.slice(7);
    const db = getDb();
    const auth = await validateApiKey(db, apiKey);

    if (!auth) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id: repoId } = await params;
    const body = await request.json();
    const parsed = standardSuggestionSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid suggestion data",
          code: "INVALID_INPUT",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { workspace_id } = parsed.data;

    // Verify repo exists and belongs to workspace
    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(
        and(
          eq(schema.repos.id, repoId),
          eq(schema.repos.workspace_id, workspace_id)
        )
      )
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch existing active suggestions for deduplication
    const existing = await db
      .select({
        title: schema.standard_suggestions.title,
        suggestion_type: schema.standard_suggestions.suggestion_type,
      })
      .from(schema.standard_suggestions)
      .where(
        and(
          eq(schema.standard_suggestions.repo_id, repoId),
          eq(schema.standard_suggestions.status, "active")
        )
      );

    const existingKeys = new Set(
      existing.map((e) => `${e.suggestion_type}:${e.title}`)
    );

    // Insert new suggestions, skipping duplicates
    const toInsert = parsed.data.suggestions.filter(
      (s) => !existingKeys.has(`${s.suggestion_type}:${s.title}`)
    );

    if (toInsert.length > 0) {
      await db.insert(schema.standard_suggestions).values(
        toInsert.map((s) => ({
          repo_id: repoId,
          workspace_id,
          suggestion_type: s.suggestion_type as "skill" | "command" | "hook",
          title: s.title,
          rationale: s.rationale,
          draft_content: s.draft_content,
          draft_filename: s.draft_filename,
          pattern_type: s.pattern_type,
          pattern_data: s.pattern_data,
        }))
      );
    }

    return NextResponse.json({
      data: {
        count: toInsert.length,
        skipped: parsed.data.suggestions.length - toInsert.length,
      },
    });
  } catch (error) {
    console.error("POST /api/v1/repos/[id]/suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/repos/{id}/suggestions — List suggestions for a repo.
 * Query params: status (optional, default "active")
 * Authenticated via session.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: repoId } = await params;
    const db = getDb();

    const [repo] = await db
      .select()
      .from(schema.repos)
      .where(eq(schema.repos.id, repoId))
      .limit(1);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    requireWorkspaceMember(session, repo.workspace_id);

    const validStatuses = ["active", "accepted", "dismissed", "expired"] as const;
    const rawStatus = request.nextUrl.searchParams.get("status") || "active";
    const status = validStatuses.includes(rawStatus as (typeof validStatuses)[number])
      ? (rawStatus as (typeof validStatuses)[number])
      : "active";

    const suggestions = await db
      .select()
      .from(schema.standard_suggestions)
      .where(
        and(
          eq(schema.standard_suggestions.repo_id, repoId),
          eq(
            schema.standard_suggestions.status,
            status as "active" | "accepted" | "dismissed" | "expired"
          )
        )
      )
      .orderBy(desc(schema.standard_suggestions.created_at));

    return NextResponse.json({ data: suggestions });
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
    console.error("GET /api/v1/repos/[id]/suggestions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

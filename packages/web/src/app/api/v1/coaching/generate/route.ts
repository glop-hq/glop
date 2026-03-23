import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { coachingGenerateSchema } from "@glop/shared/validation";
import { generateCoachingTips } from "@/lib/coaching-tip-generator";
import { seedCuratedTips } from "@/lib/curated-tips-seed";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/coaching/generate — Trigger tip generation for a workspace.
 * Intended for cron jobs / internal use. Requires API key auth.
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();

    // API key auth only
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "API key required", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const authInfo = await validateApiKey(db, apiKey);
    if (!authInfo) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = coachingGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_INPUT", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { workspace_id } = parsed.data;

    // Seed curated tips on first run
    await seedCuratedTips(db);

    const tipsCreated = await generateCoachingTips(workspace_id);

    return NextResponse.json({
      data: { tips_created: tipsCreated, workspace_id },
    });
  } catch (error) {
    console.error("POST /api/v1/coaching/generate error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

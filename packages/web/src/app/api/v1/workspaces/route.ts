import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { workspaceCreateRequestSchema } from "@glop/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const workspaceIds = session.workspaces.map((w) => w.id);

    if (workspaceIds.length === 0) {
      return NextResponse.json({ workspaces: [] });
    }

    const db = getDb();
    const workspaces = await db
      .select()
      .from(schema.workspaces)
      .where(inArray(schema.workspaces.id, workspaceIds));

    return NextResponse.json({ workspaces });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Workspaces list error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const parsed = workspaceCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    const workspaceId = crypto.randomUUID();
    const slug =
      parsed.data.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "workspace";

    await db.insert(schema.workspaces).values({
      id: workspaceId,
      name: parsed.data.name,
      slug: `${slug}-${workspaceId.slice(0, 6)}`,
      created_by: session.user_id,
      created_at: now,
      updated_at: now,
    });

    await db.insert(schema.workspace_members).values({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: session.user_id,
      role: "admin",
      created_at: now,
    });

    const [workspace] = await db
      .select()
      .from(schema.workspaces)
      .where(inArray(schema.workspaces.id, [workspaceId]));

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("Workspace create error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

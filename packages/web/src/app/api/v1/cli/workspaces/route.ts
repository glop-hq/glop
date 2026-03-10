import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json(
      { error: "Missing API key", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const db = getDb();
  const auth = await validateApiKey(db, token);

  if (!auth) {
    return NextResponse.json(
      { error: "Invalid API key", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  if (!auth.user_id) {
    return NextResponse.json(
      { error: "API key not linked to a user", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Get all workspaces the user is a member of
  const memberships = await db
    .select({ workspace_id: schema.workspace_members.workspace_id })
    .from(schema.workspace_members)
    .where(eq(schema.workspace_members.user_id, auth.user_id));

  const workspaceIds = memberships.map((m) => m.workspace_id);

  if (workspaceIds.length === 0) {
    return NextResponse.json({
      current_workspace_id: auth.workspace_id,
      workspaces: [],
    });
  }

  const workspaces = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      slug: schema.workspaces.slug,
    })
    .from(schema.workspaces)
    .where(inArray(schema.workspaces.id, workspaceIds));

  return NextResponse.json({
    current_workspace_id: auth.workspace_id,
    workspaces,
  });
}

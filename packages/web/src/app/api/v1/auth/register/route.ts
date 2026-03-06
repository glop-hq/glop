import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { registerDeveloper } from "@/lib/auth";
import { authRegisterSchema } from "@glop/shared";
import { getSessionUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = authRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check for browser session to link API key to workspace
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in first.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const requestedWorkspaceId = body.workspace_id as string | undefined;
    const workspaceId =
      (requestedWorkspaceId && session.workspaces.some((w: { id: string }) => w.id === requestedWorkspaceId)
        ? requestedWorkspaceId
        : null) || session.workspaces[0]?.id;
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No workspace found", code: "NO_WORKSPACE" },
        { status: 400 }
      );
    }

    const result = await registerDeveloper(
      db,
      parsed.data.developer_name,
      workspaceId,
      session.user_id
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

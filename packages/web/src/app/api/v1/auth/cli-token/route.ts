import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { registerDeveloper } from "@/lib/auth";
import { requireSession, AuthError } from "@/lib/session";
import {
  requireWorkspaceMember,
  WorkspaceAuthError,
} from "@/lib/workspace-auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const callbackPort = body.callback_port;

    if (!callbackPort || typeof callbackPort !== "number") {
      return NextResponse.json(
        { error: "Missing callback_port", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const workspaceId = body.workspace_id || session.workspaces[0]?.id;
    if (!workspaceId) {
      return NextResponse.json(
        { error: "No workspace found", code: "NO_WORKSPACE" },
        { status: 400 }
      );
    }

    requireWorkspaceMember(session, workspaceId);

    const db = getDb();
    const result = await registerDeveloper(
      db,
      session.name || session.email,
      workspaceId,
      session.user_id
    );

    // Fetch workspace details for the CLI callback
    const [workspace] = await db
      .select({
        name: schema.workspaces.name,
        slug: schema.workspaces.slug,
      })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId));

    const params = new URLSearchParams({
      api_key: result.api_key,
      developer_id: result.developer_id,
      developer_name: session.name || session.email,
      workspace_id: workspaceId,
      ...(workspace && {
        workspace_name: workspace.name,
        workspace_slug: workspace.slug,
      }),
    });

    const redirectUrl = `http://127.0.0.1:${callbackPort}/callback?${params}`;

    return NextResponse.json({ redirect_url: redirectUrl });
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
    console.error("CLI token error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

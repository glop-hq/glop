import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSession, AuthError } from "@/lib/session";
import { isWorkspaceAdmin, getWorkspaceMembership } from "@/lib/workspace-auth";
import { isGitHubAppConfigured } from "@/lib/github-app";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId } = await params;

    if (!getWorkspaceMembership(session, workspaceId)) {
      return NextResponse.json(
        { error: "Not a member of this workspace", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const configured = isGitHubAppConfigured();

    const db = getDb();
    const [installation] = await db
      .select()
      .from(schema.github_installations)
      .where(
        and(
          eq(schema.github_installations.workspace_id, workspaceId),
          eq(schema.github_installations.enabled, true)
        )
      )
      .limit(1);

    return NextResponse.json({
      configured,
      connected: !!installation,
      installation: installation
        ? {
            github_account_login: installation.github_account_login,
            github_account_type: installation.github_account_type,
            created_at: installation.created_at,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("GitHub status error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: workspaceId } = await params;

    if (!isWorkspaceAdmin(session, workspaceId)) {
      return NextResponse.json(
        { error: "Admin access required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const db = getDb();
    await db
      .update(schema.github_installations)
      .set({ enabled: false, updated_at: new Date().toISOString() })
      .where(eq(schema.github_installations.workspace_id, workspaceId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    console.error("GitHub disconnect error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

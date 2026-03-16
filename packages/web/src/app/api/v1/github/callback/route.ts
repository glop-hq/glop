import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isGitHubAppConfigured, getAppOctokit } from "@/lib/github-app";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!isGitHubAppConfigured()) {
    return NextResponse.redirect(
      new URL("/settings/workspace?github=error", request.url)
    );
  }

  const installationId = request.nextUrl.searchParams.get("installation_id");
  const setupAction = request.nextUrl.searchParams.get("setup_action");

  if (!installationId || setupAction !== "install") {
    return NextResponse.redirect(
      new URL("/settings/workspace?github=error", request.url)
    );
  }

  // Find the user's admin workspace
  const adminWorkspace = session.workspaces.find((w) => w.role === "admin");
  if (!adminWorkspace) {
    return NextResponse.redirect(
      new URL("/settings/workspace?github=error", request.url)
    );
  }

  try {
    // Fetch installation details from GitHub using app-level JWT auth
    const octokit = getAppOctokit();
    const { data: installation } = await octokit.rest.apps.getInstallation({
      installation_id: parseInt(installationId, 10),
    });

    const account = installation.account as Record<string, unknown> | null;
    const accountLogin = (account?.login as string) || "unknown";
    const accountType = (account?.type as string) || "Organization";

    const db = getDb();

    // Upsert: delete old installation for this workspace, then insert new
    await db
      .delete(schema.github_installations)
      .where(
        eq(schema.github_installations.workspace_id, adminWorkspace.id)
      );

    await db.insert(schema.github_installations).values({
      workspace_id: adminWorkspace.id,
      installation_id: parseInt(installationId, 10),
      github_account_login: accountLogin,
      github_account_type: accountType,
      installed_by: session.user_id,
      enabled: true,
    });

    return NextResponse.redirect(
      new URL("/settings/workspace?github=installed", request.url)
    );
  } catch (error) {
    console.error("GitHub callback error:", error);
    return NextResponse.redirect(
      new URL("/settings/workspace?github=error", request.url)
    );
  }
}

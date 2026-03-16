import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { validateApiKey } from "@/lib/auth";
import { isGitHubAppConfigured, getInstallationOctokit } from "@/lib/github-app";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.glop.dev";
const COMMENT_MARKER = "<!-- glop-pr-context -->";

function parsePrUrl(url: string) {
  const match = url.match(
    /https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], prNumber: parseInt(match[3], 10) };
}

function formatComment(body: string, runId: string): string {
  const parts = [
    COMMENT_MARKER,
    "## Glop Session Context\n",
    body,
    "",
    `<sub>[View in Glop](${APP_URL}/runs/${runId}) · Posted by [Glop](${APP_URL})</sub>`,
  ];
  return parts.join("\n");
}

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

    const db = getDb();
    const auth = await validateApiKey(db, authHeader.slice(7));
    if (!auth) {
      return NextResponse.json(
        { error: "Invalid API key", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (!isGitHubAppConfigured()) {
      return NextResponse.json(
        { error: "GitHub App not configured", code: "NOT_CONFIGURED" },
        { status: 501 }
      );
    }

    const { id: runId } = await params;
    const { pr_url, comment_body } = (await request.json()) as {
      pr_url?: string;
      comment_body?: string;
    };

    if (!pr_url || !comment_body) {
      return NextResponse.json(
        { error: "pr_url and comment_body are required", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const prInfo = parsePrUrl(pr_url);
    if (!prInfo) {
      return NextResponse.json(
        { error: "Invalid PR URL", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    // Verify run belongs to workspace
    const [run] = await db
      .select({ workspace_id: schema.runs.workspace_id })
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);

    if (!run || run.workspace_id !== auth.workspace_id) {
      return NextResponse.json(
        { error: "Run not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Find GitHub installation for workspace
    const [installation] = await db
      .select()
      .from(schema.github_installations)
      .where(
        and(
          eq(schema.github_installations.workspace_id, run.workspace_id),
          eq(schema.github_installations.enabled, true)
        )
      )
      .limit(1);

    if (!installation) {
      return NextResponse.json(
        { error: "GitHub App not installed for this workspace", code: "NOT_INSTALLED" },
        { status: 404 }
      );
    }

    // Find existing PR artifact to check for existing comment
    const [artifact] = await db
      .select()
      .from(schema.artifacts)
      .where(
        and(
          eq(schema.artifacts.run_id, runId),
          eq(schema.artifacts.artifact_type, "pr"),
          eq(schema.artifacts.url, pr_url)
        )
      )
      .limit(1);

    const octokit = await getInstallationOctokit(installation.installation_id);
    const formattedBody = formatComment(comment_body, runId);

    const metadata = (artifact?.metadata || {}) as Record<string, unknown>;
    const existingCommentId = metadata.github_comment_id as number | undefined;

    if (existingCommentId) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner: prInfo.owner,
        repo: prInfo.repo,
        comment_id: existingCommentId,
        body: formattedBody,
      });

      return NextResponse.json({ updated: true, comment_id: existingCommentId });
    } else {
      // Create new comment
      const { data: comment } = await octokit.rest.issues.createComment({
        owner: prInfo.owner,
        repo: prInfo.repo,
        issue_number: prInfo.prNumber,
        body: formattedBody,
      });

      // Store comment ID in artifact metadata
      if (artifact) {
        await db
          .update(schema.artifacts)
          .set({
            metadata: { ...metadata, github_comment_id: comment.id },
          })
          .where(eq(schema.artifacts.id, artifact.id));
      }

      return NextResponse.json({ created: true, comment_id: comment.id });
    }
  } catch (error) {
    console.error("PR comment post error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

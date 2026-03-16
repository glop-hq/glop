import { eq, and } from "drizzle-orm";
import { schema, type DbClient } from "./db";
import { isGitHubAppConfigured, getInstallationOctokit } from "./github-app";
import { generatePrSummary, type RunData, type PrSummary } from "./summary-generator";

const COMMENT_MARKER = "<!-- glop-pr-context -->";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.glop.dev";

interface PrInfo {
  owner: string;
  repo: string;
  prNumber: number;
}

function parsePrUrl(url: string): PrInfo | null {
  const match = url.match(
    /https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2], prNumber: parseInt(match[3], 10) };
}

async function gatherRunData(db: DbClient, runId: string): Promise<RunData> {
  const [run] = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);

  if (!run) {
    return {
      id: runId,
      title: null,
      summary: null,
      prompts: [],
      toolUseLabels: [],
      filesTouched: [],
    };
  }

  const events = await db
    .select({ payload: schema.events.payload })
    .from(schema.events)
    .where(eq(schema.events.run_id, runId));

  const prompts: string[] = [];
  const toolUseLabels: string[] = [];

  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (payload.content_type === "prompt" && typeof payload.content === "string") {
      prompts.push(payload.content);
    }
    if (payload.content_type === "tool_use" && typeof payload.action_label === "string") {
      toolUseLabels.push(payload.action_label);
    }
  }

  return {
    id: runId,
    title: run.title,
    summary: run.summary,
    prompts,
    toolUseLabels,
    filesTouched: (run.files_touched as string[]) || [],
  };
}

function formatComment(
  sections: { runId: string; summary: PrSummary; eventCount: number; fileCount: number }[]
): string {
  const parts: string[] = [COMMENT_MARKER, "## Glop Session Context\n"];

  for (let i = 0; i < sections.length; i++) {
    const { runId, summary, eventCount, fileCount } = sections[i];
    if (i > 0) parts.push("\n---\n");

    parts.push(`> ${summary.developer_prompt}\n`);
    parts.push(`${summary.process_summary}\n`);

    if (summary.key_decisions.length > 0) {
      parts.push("**Key decisions:**");
      for (const decision of summary.key_decisions) {
        parts.push(`- ${decision}`);
      }
      parts.push("");
    }

    if (summary.files_changed.length > 0) {
      parts.push(
        "<details>",
        `<summary>Files touched (${summary.files_changed.length})</summary>\n`
      );
      for (const file of summary.files_changed) {
        parts.push(`- \`${file}\``);
      }
      parts.push("\n</details>\n");
    }

    parts.push(
      `<sub>${eventCount} events · ${fileCount} files · [View in Glop](${APP_URL}/runs/${runId})</sub>`
    );
  }

  parts.push(
    `\n<sub>Posted by [Glop](${APP_URL})</sub>`
  );

  return parts.join("\n");
}

export async function postOrUpdatePrComment(
  db: DbClient,
  runId: string,
  artifactId: string,
  prUrl: string,
  prNumber: string
): Promise<void> {
  if (!isGitHubAppConfigured()) return;

  const prInfo = parsePrUrl(prUrl);
  if (!prInfo) return;

  // Find workspace for this run
  const [run] = await db
    .select({ workspace_id: schema.runs.workspace_id, event_count: schema.runs.event_count, file_count: schema.runs.file_count })
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);
  if (!run) return;

  // Find GitHub installation for this workspace
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
  if (!installation) return;

  // Check if we already have a comment for this artifact
  const [artifact] = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.id, artifactId))
    .limit(1);
  if (!artifact) return;

  const metadata = (artifact.metadata || {}) as Record<string, unknown>;
  const existingCommentId = metadata.github_comment_id as number | undefined;

  try {
    const octokit = await getInstallationOctokit(installation.installation_id);

    if (existingCommentId) {
      // Update path: gather all runs for this PR
      await updateExistingComment(
        db,
        octokit,
        prInfo,
        prUrl,
        existingCommentId
      );
    } else {
      // Create path
      const runData = await gatherRunData(db, runId);
      const summary = await generatePrSummary(runData);
      const body = formatComment([
        { runId, summary, eventCount: run.event_count, fileCount: run.file_count },
      ]);

      const { data: comment } = await octokit.rest.issues.createComment({
        owner: prInfo.owner,
        repo: prInfo.repo,
        issue_number: prInfo.prNumber,
        body,
      });

      // Store comment ID in artifact metadata
      await db
        .update(schema.artifacts)
        .set({
          metadata: { ...metadata, github_comment_id: comment.id },
        })
        .where(eq(schema.artifacts.id, artifactId));
    }
  } catch (error) {
    console.error("Failed to post/update PR comment:", error);
  }
}

async function updateExistingComment(
  db: DbClient,
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
  prInfo: PrInfo,
  prUrl: string,
  commentId: number
): Promise<void> {
  // Find ALL artifacts for this PR URL across all runs
  const prArtifacts = await db
    .select()
    .from(schema.artifacts)
    .where(
      and(
        eq(schema.artifacts.artifact_type, "pr"),
        eq(schema.artifacts.url, prUrl)
      )
    );

  const sections: { runId: string; summary: PrSummary; eventCount: number; fileCount: number }[] = [];

  for (const art of prArtifacts) {
    const [run] = await db
      .select({ event_count: schema.runs.event_count, file_count: schema.runs.file_count })
      .from(schema.runs)
      .where(eq(schema.runs.id, art.run_id))
      .limit(1);

    const runData = await gatherRunData(db, art.run_id);
    const summary = await generatePrSummary(runData);
    sections.push({
      runId: art.run_id,
      summary,
      eventCount: run?.event_count || 0,
      fileCount: run?.file_count || 0,
    });
  }

  if (sections.length === 0) return;

  const body = formatComment(sections);

  await octokit.rest.issues.updateComment({
    owner: prInfo.owner,
    repo: prInfo.repo,
    comment_id: commentId,
    body,
  });
}

export async function updatePrCommentsForRun(
  db: DbClient,
  runId: string
): Promise<void> {
  if (!isGitHubAppConfigured()) return;

  // Look up run + installation once (same for all artifacts)
  const [run] = await db
    .select({ workspace_id: schema.runs.workspace_id })
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
    .limit(1);
  if (!run) return;

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
  if (!installation) return;

  // Find PR artifacts for this run
  const prArtifacts = await db
    .select()
    .from(schema.artifacts)
    .where(
      and(
        eq(schema.artifacts.run_id, runId),
        eq(schema.artifacts.artifact_type, "pr")
      )
    );

  let octokit: Awaited<ReturnType<typeof getInstallationOctokit>> | null = null;

  for (const artifact of prArtifacts) {
    const metadata = (artifact.metadata || {}) as Record<string, unknown>;
    const commentId = metadata.github_comment_id as number | undefined;
    if (!commentId || !artifact.url) continue;

    const prInfo = parsePrUrl(artifact.url);
    if (!prInfo) continue;

    try {
      if (!octokit) {
        octokit = await getInstallationOctokit(installation.installation_id);
      }
      await updateExistingComment(
        db,
        octokit,
        prInfo,
        artifact.url,
        commentId
      );
    } catch (error) {
      console.error("Failed to update PR comment for run:", error);
    }
  }
}

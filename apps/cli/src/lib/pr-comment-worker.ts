/**
 * Background worker that generates and posts a PR context comment.
 * Invoked as a detached child process by the hook command.
 *
 * Args: serverUrl apiKey runId prUrl
 */

import { execFileSync } from "child_process";

const [serverUrl, runId, prUrl] = process.argv.slice(2);
const apiKey = process.env.GLOP_API_KEY;

if (!serverUrl || !apiKey || !runId || !prUrl) {
  process.exit(1);
}

async function main() {
  // 1. Fetch run context from server
  const contextRes = await fetch(`${serverUrl}/api/v1/runs/${runId}/context`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!contextRes.ok) {
    process.exit(1);
  }

  const context = (await contextRes.json()) as {
    title: string | null;
    summary: string | null;
    prompts: string[];
    tool_use_labels: string[];
    files_touched: string[];
    file_count: number;
    event_count: number;
  };

  // 2. Build prompt for claude
  const prompt = [
    "Generate a concise GitHub PR comment summarizing this AI coding session.",
    "Output ONLY the markdown body — no wrapping, no ```markdown fences, no preamble.",
    "",
    `Session title: ${context.title || "Untitled"}`,
    `Session summary: ${context.summary || "No summary"}`,
    "",
    "Developer prompts:",
    ...context.prompts.map((p, i) => `${i + 1}. ${p}`),
    "",
    "Actions taken:",
    ...context.tool_use_labels.map((l, i) => `${i + 1}. ${l}`),
    "",
    "Files touched:",
    ...context.files_touched.map((f) => `- ${f}`),
    "",
    "Format the comment with:",
    "- A blockquote with the developer's core request",
    "- 2-3 sentences on how the AI approached the task",
    "- A bullet list of key decisions (if any)",
    "- A collapsible <details> section listing files touched",
    `- Stats line: ${context.event_count} events · ${context.file_count} files`,
  ].join("\n");

  // 3. Generate summary via local claude CLI
  let commentBody: string;
  try {
    commentBody = execFileSync("claude", ["-p", prompt], {
      encoding: "utf-8",
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch {
    // claude CLI not available or failed — fall back to template
    commentBody = buildTemplate(context);
  }

  if (!commentBody) {
    commentBody = buildTemplate(context);
  }

  // 4. Add footer and post via gh CLI
  const runUrl = `${serverUrl}/runs/${runId}`;
  const fullComment = [
    commentBody,
    "",
    `<sub>[View in Glop](${runUrl}) · Posted by [Glop](${serverUrl})</sub>`,
  ].join("\n");

  execFileSync("gh", ["pr", "comment", prUrl, "--body", fullComment], {
    encoding: "utf-8",
    timeout: 15000,
  });
}

function buildTemplate(context: {
  prompts: string[];
  summary: string | null;
  title: string | null;
  files_touched: string[];
  file_count: number;
  event_count: number;
}): string {
  const parts: string[] = [];

  parts.push(`> ${context.prompts[0] || "No prompt recorded"}\n`);
  parts.push(`${context.summary || context.title || "No summary available"}\n`);

  if (context.files_touched.length > 0) {
    parts.push(
      "<details>",
      `<summary>Files touched (${context.files_touched.length})</summary>\n`
    );
    for (const file of context.files_touched) {
      parts.push(`- \`${file}\``);
    }
    parts.push("\n</details>\n");
  }

  parts.push(
    `<sub>${context.event_count} events · ${context.file_count} files</sub>`
  );

  return parts.join("\n");
}

main().catch(() => process.exit(1));

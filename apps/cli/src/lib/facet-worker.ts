/**
 * Background worker that extracts a structured facet from a session transcript.
 * Invoked as a detached child process by the hook command on SessionEnd.
 *
 * Args: serverUrl workspaceId repoRoot repoKey runId transcriptPath
 * Env: GLOP_API_KEY
 */

import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { SUMMARIZE_CHUNK_PROMPT, EXTRACT_FACET_PROMPT } from "./facet-prompts.js";
import { parseTranscript } from "./transcript-parser.js";

const [serverUrl, workspaceId, _repoRoot, repoKey, runId, transcriptPath] =
  process.argv.slice(2);
const apiKey = process.env.GLOP_API_KEY;
const developerId = process.env.GLOP_DEVELOPER_ID || "unknown";

if (!serverUrl || !apiKey || !workspaceId || !repoKey || !runId || !transcriptPath) {
  process.exit(1);
}

const MAX_TRANSCRIPT = 30000;
const CHUNK_SIZE = 25000;

function formatConversation(messages: TranscriptMessage[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

function runClaude(prompt: string): string {
  return execFileSync("claude", ["-p", prompt, "--model", "haiku"], {
    encoding: "utf-8",
    timeout: 90000,
    maxBuffer: 1024 * 1024,
  }).trim();
}

function chunkAndSummarize(text: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  const summaries = chunks.map((chunk) =>
    runClaude(SUMMARIZE_CHUNK_PROMPT + chunk)
  );

  return summaries.join("\n\n---\n\n");
}

async function main() {
  const raw = readFileSync(transcriptPath, "utf-8");
  const messages = parseTranscript(raw);

  // Skip short sessions
  const userMessages = messages.filter((m) => m.role === "user");
  if (userMessages.length < 2) {
    process.exit(0);
  }

  let conversation = formatConversation(messages);

  // Chunk and summarize if too long
  if (conversation.length > MAX_TRANSCRIPT) {
    conversation = chunkAndSummarize(conversation);
  }

  // Extract facet
  const output = runClaude(EXTRACT_FACET_PROMPT + conversation);

  // Parse JSON from output
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    process.exit(1);
  }

  const facet = JSON.parse(jsonMatch[0]);

  // Submit to server — cherry-pick known fields, never spread raw LLM output
  await fetch(`${serverUrl}/api/v1/facets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      run_id: runId,
      workspace_id: workspaceId,
      repo_key: repoKey,
      developer_id: developerId,
      goal_categories: facet.goal_categories,
      outcome: facet.outcome,
      satisfaction: facet.satisfaction,
      session_type: facet.session_type,
      friction_counts: facet.friction_counts,
      friction_detail: facet.friction_detail ?? null,
      primary_success: facet.primary_success ?? null,
      files_touched: facet.files_touched ?? [],
      area: facet.area ?? null,
      brief_summary: facet.brief_summary,
      duration_minutes: facet.duration_minutes ?? null,
      iteration_count: facet.iteration_count ?? null,
    }),
    signal: AbortSignal.timeout(10000),
  });
}

main().catch(() => process.exit(1));

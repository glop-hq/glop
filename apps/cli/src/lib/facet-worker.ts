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
import { parseTranscript, extractContextHealth } from "./transcript-parser.js";

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

// Known context window limits by model family
const CONTEXT_LIMITS: Record<string, number> = {
  "claude-opus-4": 200000,
  "claude-sonnet-4": 200000,
  "claude-haiku-4": 200000,
  "claude-3-5-sonnet": 200000,
  "claude-3-5-haiku": 200000,
  "claude-3-opus": 200000,
  "claude-3-sonnet": 200000,
  "claude-3-haiku": 200000,
};

function guessContextLimit(raw: string): number {
  // Try to find model name in transcript
  for (const line of raw.split("\n").slice(0, 50)) {
    try {
      const obj = JSON.parse(line);
      const model = obj.message?.model;
      if (typeof model === "string") {
        for (const [prefix, limit] of Object.entries(CONTEXT_LIMITS)) {
          if (model.startsWith(prefix)) return limit;
        }
      }
    } catch { /* skip */ }
  }
  return 200000; // default
}

async function main() {
  const raw = readFileSync(transcriptPath, "utf-8");

  // Extract and submit context health (fast, no LLM call needed)
  try {
    const health = extractContextHealth(raw);
    if (health) {
      const contextLimit = guessContextLimit(raw);
      const peakPct = Math.round((health.peak_input_tokens / contextLimit) * 1000) / 10;
      const endPct = Math.round((health.end_input_tokens / contextLimit) * 1000) / 10;

      await fetch(`${serverUrl}/api/v1/context-health`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          run_id: runId,
          workspace_id: workspaceId,
          repo_key: repoKey,
          compaction_count: health.compaction_count,
          peak_utilization_pct: peakPct,
          end_utilization_pct: endPct,
          total_input_tokens: health.total_input_tokens,
          total_output_tokens: health.total_output_tokens,
          context_limit_tokens: contextLimit,
        }),
        signal: AbortSignal.timeout(10000),
      });
    }
  } catch {
    // Best-effort — don't block facet extraction
  }

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

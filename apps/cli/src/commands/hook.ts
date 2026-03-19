import { Command } from "commander";
import { openSync, readSync, closeSync, readFileSync } from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import { loadConfig } from "../lib/config.js";
import { getRepoKey, getBranch, getGitUserName, getGitUserEmail, getCommitDiffStats } from "../lib/git.js";

function extractSlugFromTranscript(transcriptPath: string): string | null {
  try {
    const fd = openSync(transcriptPath, "r");
    const buf = Buffer.alloc(262144); // 256KB
    const bytesRead = readSync(fd, buf, 0, 262144, 0);
    closeSync(fd);
    const head = buf.toString("utf-8", 0, bytesRead);
    const match = head.match(/"slug":"([^"]+)"/);
    if (match) return match[1];
    if (bytesRead < 262144) return null; // already read the whole file
    // Fallback: read entire file for edge cases (>256KB before slug)
    const full = readFileSync(transcriptPath, "utf-8");
    return full.match(/"slug":"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export const hookCommand = new Command("__hook")
  .description("internal")
  .action(async () => {
    const config = loadConfig();
    if (!config) return;

    let input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(input);
    } catch {
      return;
    }

    // Enrich with git info
    payload.repo_key = getRepoKey() || payload.cwd || "unknown";
    payload.branch = getBranch();
    payload.machine_id = config.machine_id;
    payload.git_user_name = getGitUserName();
    payload.git_user_email = getGitUserEmail();

    // Enrich commits with diff stats
    if (
      payload.hook_event_name === "PostToolUse" &&
      payload.tool_name === "Bash" &&
      typeof payload.tool_response === "string" &&
      /\bgit\s+commit\b/.test(
        typeof (payload.tool_input as Record<string, unknown>)?.command === "string"
          ? (payload.tool_input as Record<string, unknown>).command as string
          : ""
      ) &&
      /\[\w[^\]]*\s+[a-f0-9]{7,}\]/.test(payload.tool_response)
    ) {
      const diffStats = getCommitDiffStats();
      if (diffStats) {
        payload.commit_diff_stats = diffStats;
      }
    }

    // Extract conversation slug from transcript file (skip high-frequency PostToolUse)
    const skipSlugEvents = new Set(["PostToolUse"]);
    if (!skipSlugEvents.has(payload.hook_event_name as string) && typeof payload.transcript_path === "string") {
      const slug = extractSlugFromTranscript(payload.transcript_path);
      if (slug) payload.slug = slug;
    }

    // Detect PR creation for background comment generation
    const isPrCreation =
      payload.hook_event_name === "PostToolUse" &&
      payload.tool_name === "Bash" &&
      typeof payload.tool_response === "string" &&
      /\bgh\s+pr\s+create\b/.test(
        typeof (payload.tool_input as Record<string, unknown>)?.command === "string"
          ? (payload.tool_input as Record<string, unknown>).command as string
          : ""
      ) &&
      /https:\/\/github\.com\/[^\s]+\/pull\/\d+/.test(payload.tool_response);

    let prUrl: string | null = null;
    if (isPrCreation) {
      const prMatch = (payload.tool_response as string).match(
        /(https:\/\/github\.com\/[^\s]+\/pull\/\d+)/
      );
      if (prMatch) prUrl = prMatch[1];
    }

    try {
      const res = await fetch(`${config.server_url}/api/v1/ingest/hook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      // Parse response body once (needed for SessionStart and PR comment)
      const resBody = res.ok
        ? await res.json().catch(() => ({})) as { run_id?: string }
        : null;

      // On SessionStart, print connection status and run URL
      if (payload.hook_event_name === "SessionStart") {
        if (res.ok && resBody) {
          const runUrl = resBody.run_id
            ? `${config.server_url}/runs/${resBody.run_id}`
            : null;
          console.log(`glop: connected to ${config.server_url}`);
          if (runUrl) {
            console.log(`glop: Add "Glop-Run: ${runUrl}" as a git trailer in all commit messages and PR descriptions.`);
          }
        } else if (res.status === 401) {
          console.log("glop: API key expired or invalid — run `glop auth` to re-authenticate");
        } else {
          console.log(`glop: server returned HTTP ${res.status}`);
        }
      }

      // Spawn background worker to generate and post PR comment
      if (prUrl && resBody?.run_id) {
        try {
          const workerPath = path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "lib",
            "pr-comment-worker.js"
          );
          const child = spawn(
            process.execPath,
            [workerPath, config.server_url, resBody.run_id, prUrl],
            { detached: true, stdio: "ignore", env: { ...process.env, GLOP_API_KEY: config.api_key } }
          );
          child.unref();
        } catch {
          // Silently ignore — PR comment is best-effort
        }
      }
    } catch {
      if (payload.hook_event_name === "SessionStart") {
        console.log(`glop: server unreachable at ${config.server_url}`);
      }
    }
  });

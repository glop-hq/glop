import { Command } from "commander";
import { openSync, readSync, closeSync, readFileSync } from "fs";
import { loadConfig } from "../lib/config.js";
import { getRepoKey, getBranch, getGitUserName, getGitUserEmail } from "../lib/git.js";

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

    // Extract conversation slug from transcript file (skip high-frequency PostToolUse)
    const skipSlugEvents = new Set(["PostToolUse"]);
    if (!skipSlugEvents.has(payload.hook_event_name as string) && typeof payload.transcript_path === "string") {
      const slug = extractSlugFromTranscript(payload.transcript_path);
      if (slug) payload.slug = slug;
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

      // On SessionStart, print connection status and run URL
      if (payload.hook_event_name === "SessionStart") {
        if (res.ok) {
          const body = await res.json() as { run_id?: string };
          const runUrl = body.run_id
            ? `${config.server_url}/runs/${body.run_id}`
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
    } catch {
      if (payload.hook_event_name === "SessionStart") {
        console.log(`glop: server unreachable at ${config.server_url}`);
      }
    }
  });

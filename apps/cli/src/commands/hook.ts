import { Command } from "commander";
import { openSync, readSync, closeSync } from "fs";
import { loadConfig } from "../lib/config.js";
import { getRepoKey, getBranch, getGitUserName, getGitUserEmail } from "../lib/git.js";

function extractSlugFromTranscript(transcriptPath: string): string | null {
  try {
    const fd = openSync(transcriptPath, "r");
    const buf = Buffer.alloc(65536);
    const bytesRead = readSync(fd, buf, 0, 65536, 0);
    closeSync(fd);
    const head = buf.toString("utf-8", 0, bytesRead);
    const match = head.match(/"slug":"([^"]+)"/);
    return match ? match[1] : null;
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

      // On SessionStart, print connection status
      if (payload.hook_event_name === "SessionStart") {
        if (res.ok) {
          console.log(`glop: connected to ${config.server_url}`);
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

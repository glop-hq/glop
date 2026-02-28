import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { getRepoKey, getBranch } from "../lib/git.js";

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
          console.log("glop: auth failed — run glop auth to re-authenticate");
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

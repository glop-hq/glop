import { Command } from "commander";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoKey } from "../lib/git.js";

interface CoachingTip {
  id: string;
  title: string;
  body: string;
  source_type: string;
  priority: string;
  status: string;
  repo_key?: string;
  created_at: string;
}

export const tipCommand = new Command("tip")
  .description("Manage coaching tips for this repo");

tipCommand
  .command("list")
  .description("List active coaching tips")
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.error("Not logged in. Run `glop login` first.");
      process.exit(1);
    }

    const repoConfig = loadRepoConfig();
    if (!repoConfig) {
      console.error("Repo not linked. Run `glop link` first.");
      process.exit(1);
    }

    const repoKey = getRepoKey() || "unknown";

    try {
      const res = await fetch(
        `${config.server_url}/api/v1/coaching/tips?workspace_id=${repoConfig.workspace_id}&repo_key=${encodeURIComponent(repoKey)}&channel=dashboard`,
        {
          headers: { Authorization: `Bearer ${config.api_key}` },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) {
        console.error(`Server returned HTTP ${res.status}`);
        process.exit(1);
      }

      const body = (await res.json()) as { data: CoachingTip[] };
      const tips = body.data;

      if (tips.length === 0) {
        console.log("No active coaching tips for this repo.");
        return;
      }

      console.log(`\n  Coaching Tips (${tips.length})\n`);
      for (const tip of tips) {
        const priorityBadge =
          tip.priority === "high" ? "🔴" : tip.priority === "medium" ? "🟡" : "🟢";
        console.log(`  ${priorityBadge} ${tip.title}`);
        console.log(`    ${tip.body}`);
        console.log(`    Source: ${tip.source_type.replace(/_/g, " ")} | ID: ${tip.id}`);
        console.log();
      }
    } catch (error) {
      console.error("Failed to fetch coaching tips:", (error as Error).message);
      process.exit(1);
    }
  });

tipCommand
  .command("dismiss <id>")
  .description("Dismiss a coaching tip")
  .option("-r, --reason <reason>", "Reason for dismissal")
  .action(async (id: string, opts: { reason?: string }) => {
    const config = loadConfig();
    if (!config) {
      console.error("Not logged in. Run `glop login` first.");
      process.exit(1);
    }

    try {
      const body: Record<string, string> = { status: "dismissed" };
      if (opts.reason) body.dismiss_reason = opts.reason;

      const res = await fetch(
        `${config.server_url}/api/v1/coaching/tips/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          console.error("Tip not found.");
        } else {
          console.error(`Server returned HTTP ${res.status}`);
        }
        process.exit(1);
      }

      console.log("Tip dismissed.");
    } catch (error) {
      console.error("Failed to dismiss tip:", (error as Error).message);
      process.exit(1);
    }
  });

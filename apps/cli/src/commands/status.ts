import { Command } from "commander";
import { apiRequest } from "../lib/api-client.js";
import { getRepoKey, getBranch } from "../lib/git.js";

export const statusCommand = new Command("status")
  .description("Show current Run status for this repo")
  .action(async () => {
    const repoKey = getRepoKey();
    const branch = getBranch();

    if (!repoKey) {
      console.error("Not in a git repository with a remote.");
      process.exit(1);
    }

    try {
      const res = await apiRequest("/api/v1/live");
      if (!res.ok) {
        console.error("Failed to fetch status:", res.statusText);
        process.exit(1);
      }

      const data = (await res.json()) as {
        runs: Array<{
          id: string;
          status: string;
          phase: string;
          title: string | null;
          repo_key: string;
          branch_name: string;
          last_action_label: string | null;
          last_event_at: string;
        }>;
      };

      // Find runs matching this repo
      const matchingRuns = data.runs.filter(
        (r) =>
          r.repo_key.includes(repoKey.split("/").pop() || "") &&
          r.branch_name === branch
      );

      if (matchingRuns.length === 0) {
        console.log(`No active runs for ${repoKey} (${branch})`);
        return;
      }

      for (const run of matchingRuns) {
        console.log(`Run: ${run.id.slice(0, 8)}`);
        console.log(`  Status: ${run.status}`);
        console.log(`  Phase:  ${run.phase}`);
        console.log(`  Title:  ${run.title || "-"}`);
        console.log(`  Last:   ${run.last_action_label || "-"}`);
        console.log(
          `  Updated: ${new Date(run.last_event_at).toLocaleString()}`
        );
      }
    } catch (err) {
      console.error(
        "Failed to connect:",
        err instanceof Error ? err.message : err
      );
      process.exit(1);
    }
  });

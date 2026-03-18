import { Command } from "commander";
import { loadConfig, loadRepoConfig, saveRepoConfig } from "../lib/config.js";
import { getRepoRoot } from "../lib/git.js";
import { interactiveSelect } from "../lib/select.js";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspacesResponse {
  current_workspace_id: string | null;
  workspaces: Workspace[];
}

export const linkCommand = new Command("link")
  .description("Bind this repo to a glop workspace")
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.error("Not authenticated. Run `glop login` first.");
      process.exit(1);
    }

    const repoRoot = getRepoRoot();
    if (!repoRoot) {
      console.error("Not in a git repository. Run this from a git repo.");
      process.exit(1);
    }

    // Check if already bound
    const existingRepo = loadRepoConfig();
    if (existingRepo) {
      console.log(`This repo is already bound to workspace ${existingRepo.workspace_id}.`);
      if (!process.stdin.isTTY) {
        process.exit(0);
      }
      console.log("Re-running to switch workspace...\n");
    }

    // Fetch workspaces
    let data: WorkspacesResponse;
    try {
      const res = await fetch(`${config.server_url}/api/v1/cli/workspaces`, {
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          "X-Machine-Id": config.machine_id,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.status === 401) {
        console.error("API key is invalid or expired. Run `glop login` again.");
        process.exit(1);
      }

      if (!res.ok) {
        console.error(`Server error: HTTP ${res.status}. Try again later.`);
        process.exit(1);
      }

      data = (await res.json()) as WorkspacesResponse;
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        console.error(`Cannot connect to ${config.server_url}`);
      } else {
        console.error("Failed to fetch workspaces.");
      }
      process.exit(1);
    }

    if (data.workspaces.length === 0) {
      console.error("No workspaces found. Create one at " + config.server_url);
      process.exit(1);
    }

    let selectedWorkspace: Workspace;

    if (data.workspaces.length === 1) {
      // Auto-bind to the only workspace
      selectedWorkspace = data.workspaces[0];
    } else {
      // Interactive picker
      if (!process.stdin.isTTY) {
        console.error("Multiple workspaces available. Run interactively to choose.");
        process.exit(1);
      }

      const currentId = existingRepo?.workspace_id || data.current_workspace_id;
      const items = data.workspaces.map((w) => {
        const marker = w.id === currentId ? "●" : "○";
        return `${marker}  ${w.name}`;
      });

      const currentIndex = data.workspaces.findIndex((w) => w.id === currentId);

      console.log("  Select a workspace:\n");
      console.log("  \x1b[2m↑/↓ navigate · Enter select · Esc cancel\x1b[0m\n");

      const selected = await interactiveSelect(items, Math.max(currentIndex, 0));

      if (selected === null) {
        console.log("\n  Cancelled.");
        process.exit(0);
      }

      selectedWorkspace = data.workspaces[selected];
    }

    saveRepoConfig({ workspace_id: selectedWorkspace.id });

    console.log(`✓ Bound to workspace "${selectedWorkspace.name}" — sessions will appear at ${config.server_url}/live`);
  });

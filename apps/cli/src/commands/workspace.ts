import { Command } from "commander";
import { loadConfig, saveConfig, getMachineId } from "../lib/config.js";
import { openBrowser, findOpenPort, waitForCallback } from "../lib/auth-flow.js";
import { interactiveSelect } from "../lib/select.js";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspacesResponse {
  current_workspace_id: string;
  workspaces: Workspace[];
}

export const workspaceCommand = new Command("workspace")
  .description("View or switch workspaces")
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.error("Not authenticated. Run `glop auth` first.");
      process.exit(1);
    }

    // Fetch workspaces from API
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
        console.error("API key is invalid. Run `glop auth` to re-authenticate.");
        process.exit(1);
      }

      if (!res.ok) {
        console.error(`Failed to fetch workspaces (HTTP ${res.status}).`);
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
      console.log("No workspaces found.");
      process.exit(0);
    }

    const currentId = data.current_workspace_id;

    // Non-TTY: just print current workspace
    if (!process.stdin.isTTY) {
      const current = data.workspaces.find((w) => w.id === currentId);
      console.log(current ? current.name : currentId);
      process.exit(0);
    }

    // Single workspace: no need for a picker
    if (data.workspaces.length === 1) {
      console.log(`  Workspace: ${data.workspaces[0].name}`);
      console.log("  (only workspace)");
      process.exit(0);
    }

    // Build display items
    const items = data.workspaces.map((w) => {
      const marker = w.id === currentId ? "●" : "○";
      return `${marker}  ${w.name}`;
    });

    const currentIndex = data.workspaces.findIndex((w) => w.id === currentId);

    console.log("\n  Workspaces:\n");
    console.log("  \x1b[2m↑/↓ navigate · Enter select · Esc cancel\x1b[0m\n");

    const selected = await interactiveSelect(items, Math.max(currentIndex, 0));

    if (selected === null) {
      console.log("\n  Cancelled.");
      process.exit(0);
    }

    const selectedWorkspace = data.workspaces[selected];

    if (selectedWorkspace.id === currentId) {
      console.log(`\n  Already on ${selectedWorkspace.name}.`);
      process.exit(0);
    }

    // Switch workspace via browser auth flow
    console.log(`\n  Switching to ${selectedWorkspace.name}...`);
    console.log("  Opening browser for authorization...\n");

    const port = await findOpenPort();
    const machineId = getMachineId();
    const authUrl = `${config.server_url}/cli-auth?port=${port}&workspace_id=${selectedWorkspace.id}`;

    console.log("  If the browser doesn't open, visit this URL manually:");
    console.log(`  ${authUrl}\n`);
    console.log("  Waiting for authorization...");

    openBrowser(authUrl);

    const result = await waitForCallback(port);

    saveConfig({
      ...config,
      api_key: result.api_key,
      developer_id: result.developer_id,
      developer_name: result.developer_name,
      machine_id: machineId,
      workspace_id: result.workspace_id,
      workspace_name: result.workspace_name,
      workspace_slug: result.workspace_slug,
    });

    console.log(`\n  Switched to ${result.workspace_name || selectedWorkspace.name}!`);
    process.exit(0);
  });

import { Command } from "commander";
import { saveConfig, getMachineId, getDefaultServerUrl } from "../lib/config.js";
import { openBrowser, findOpenPort, waitForCallback } from "../lib/auth-flow.js";

export const authCommand = new Command("auth")
  .description("Authenticate with a glop server")
  .option("-s, --server <url>", "Server URL")
  .action(async (opts) => {
    const serverUrl = (opts.server || getDefaultServerUrl()).replace(/\/+$/, "");

    const port = await findOpenPort();
    const machineId = getMachineId();

    console.log("Opening browser for authentication...");
    console.log(
      "If the browser doesn't open, visit this URL manually:"
    );

    const authUrl = `${serverUrl}/cli-auth?port=${port}`;
    console.log(`  ${authUrl}\n`);
    console.log("Waiting for authorization...");

    openBrowser(authUrl);

    const result = await waitForCallback(port);

    saveConfig({
      server_url: serverUrl,
      api_key: result.api_key,
      developer_id: result.developer_id,
      developer_name: result.developer_name,
      machine_id: machineId,
      workspace_id: result.workspace_id,
      workspace_name: result.workspace_name,
      workspace_slug: result.workspace_slug,
    });

    console.log("\nAuthenticated successfully!");
    console.log(`  Developer:  ${result.developer_name}`);
    if (result.workspace_name) {
      console.log(`  Workspace:  ${result.workspace_name}`);
    }
    console.log(`  Server:     ${serverUrl}`);
    console.log(`  Machine:    ${machineId.slice(0, 8)}...`);
    console.log(`\nAPI key saved to ~/.glop/config.json`);
    console.log(
      `\n→ Run \`glop init\` in a repo to start streaming sessions.`
    );

    process.exit(0);
  });

import { Command } from "commander";
import { saveGlobalConfig, getMachineId, getDefaultServerUrl } from "../lib/config.js";
import type { GlopGlobalConfig } from "../lib/config.js";
import { openBrowser, findOpenPort, waitForCallback } from "../lib/auth-flow.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

function installGlobalHooks() {
  const claudeDir = path.join(os.homedir(), ".claude");
  const settingsFile = path.join(claudeDir, "settings.json");

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsFile)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
    } catch {
      // Start fresh if corrupted
    }
  }

  const hookHandler = {
    type: "command",
    command: "glop __hook",
  };

  const hookGroup = {
    hooks: [hookHandler],
  };

  const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
  const hookEvents = [
    "PostToolUse",
    "PermissionRequest",
    "Stop",
    "UserPromptSubmit",
    "SessionStart",
    "SessionEnd",
  ];

  for (const event of hookEvents) {
    // Preserve non-glop hooks, replace only glop's
    const existing = (hooks[event] || []).filter((group: unknown) => {
      const groupHooks = (group as Record<string, unknown[]>)?.hooks || [];
      return !groupHooks.some(
        (h: unknown) =>
          (h as Record<string, string>)?.command?.includes("glop __hook")
      );
    });
    hooks[event] = [...existing, hookGroup];
  }

  settings.hooks = hooks;

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

export const loginCommand = new Command("login")
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

    // Save flat global config
    const globalConfig: GlopGlobalConfig = {
      server_url: serverUrl,
      machine_id: machineId,
      api_key: result.api_key,
      developer_id: result.developer_id,
      developer_name: result.developer_name,
    };

    saveGlobalConfig(globalConfig);

    // Install global hooks in ~/.claude/settings.json
    installGlobalHooks();

    // Check glop is in PATH
    try {
      execSync("which glop", { stdio: ["pipe", "pipe", "pipe"] });
    } catch {
      console.warn("\nWarning: `glop` not found in PATH. Hooks won't fire until it's accessible.");
    }

    console.log("\nAuthenticated successfully!");
    console.log(`  Developer:  ${result.developer_name}`);
    console.log(`  Server:     ${serverUrl}`);
    console.log(`  Machine:    ${machineId.slice(0, 8)}...`);
    console.log(`\nAPI key saved to ~/.glop/config.json`);
    console.log(`Hooks installed in ~/.claude/settings.json`);
    console.log(
      `\n→ Run \`glop link\` in a repo to start streaming sessions.`
    );

    process.exit(0);
  });

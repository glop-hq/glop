import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { getRepoRoot } from "../lib/git.js";
import fs from "fs";
import path from "path";

export const initCommand = new Command("init")
  .description("Install Claude Code hooks in the current repo")
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.error("Not authenticated. Run `glop auth` first.");
      process.exit(1);
    }

    const repoRoot = getRepoRoot();
    if (!repoRoot) {
      console.warn("Warning: not in a git repository. Repo and branch tracking will be limited.");
    }

    const baseDir = repoRoot || process.cwd();
    const claudeDir = path.join(baseDir, ".claude");
    const settingsFile = path.join(claudeDir, "settings.json");

    // Ensure .claude directory exists
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    // Load existing settings or create new
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsFile)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
      } catch {
        // Start fresh if settings are corrupted
      }
    }

    // Inline the API key directly — Claude Code hooks run as shell commands
    // and don't have access to .claude/.env
    const hookHandler = {
      type: "command",
      command: "glop __hook",
    };

    const hookGroup = {
      hooks: [hookHandler],
    };

    // Set up hooks — all event types needed for the full conversation feed
    const hooks = (settings.hooks || {}) as Record<string, unknown[]>;
    hooks.PostToolUse = [hookGroup];
    hooks.PermissionRequest = [hookGroup];
    hooks.Stop = [hookGroup];
    hooks.UserPromptSubmit = [hookGroup];
    hooks.SessionStart = [hookGroup];
    hooks.SessionEnd = [hookGroup];
    settings.hooks = hooks;

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

    console.log("Hooks installed successfully!");
    console.log(`  Settings: ${settingsFile}`);
    console.log(`  Hooks: UserPromptSubmit, PostToolUse, PermissionRequest, Stop, SessionStart, SessionEnd`);
    console.log(`  Server: ${config.server_url}`);
    console.log(
      `\nClaude Code will now stream full session activity to your glop dashboard.`
    );
  });

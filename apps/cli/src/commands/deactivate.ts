import { Command } from "commander";
import { getRepoRoot } from "../lib/git.js";
import fs from "fs";
import path from "path";

const HOOK_EVENTS = [
  "PostToolUse",
  "PermissionRequest",
  "Stop",
  "UserPromptSubmit",
  "SessionStart",
  "SessionEnd",
];

export const deactivateCommand = new Command("deactivate")
  .description("Remove glop hooks from the current repo")
  .action(async () => {
    const repoRoot = getRepoRoot();
    if (!repoRoot) {
      console.error("Not in a git repository.");
      process.exit(1);
    }

    const settingsFile = path.join(repoRoot, ".claude", "settings.json");

    if (!fs.existsSync(settingsFile)) {
      console.log("No .claude/settings.json found. Nothing to remove.");
      return;
    }

    let settings: Record<string, unknown>;
    try {
      settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
    } catch {
      console.error("Could not parse .claude/settings.json");
      process.exit(1);
    }

    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (!hooks) {
      console.log("No hooks found in settings. Nothing to remove.");
      return;
    }

    // Remove only glop hooks (those containing glop __hook or /api/v1/ingest/hook)
    let removed = 0;
    for (const event of HOOK_EVENTS) {
      if (!hooks[event]) continue;
      const before = hooks[event].length;
      hooks[event] = hooks[event].filter((group: any) => {
        const groupHooks = group?.hooks || [];
        return !groupHooks.some(
          (h: any) =>
            h.command &&
            (h.command.includes("glop __hook") ||
              h.command.includes("/api/v1/ingest/hook"))
        );
      });
      removed += before - hooks[event].length;
      if (hooks[event].length === 0) {
        delete hooks[event];
      }
    }

    if (Object.keys(hooks).length === 0) {
      delete settings.hooks;
    }

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

    if (removed > 0) {
      console.log(`Removed glop hooks from ${removed} event(s).`);
      console.log(`  Settings: ${settingsFile}`);
    } else {
      console.log("No glop hooks found. Nothing to remove.");
    }
  });

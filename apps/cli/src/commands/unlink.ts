import { Command } from "commander";
import { getRepoRoot } from "../lib/git.js";
import fs from "fs";
import path from "path";

export const unlinkCommand = new Command("unlink")
  .description("Unbind this repo from its glop workspace")
  .action(async () => {
    const repoRoot = getRepoRoot();
    if (!repoRoot) {
      console.error("Not in a git repository.");
      process.exit(1);
    }

    const glopDir = path.join(repoRoot, ".glop");
    const configFile = path.join(glopDir, "config.json");

    if (!fs.existsSync(configFile)) {
      console.log("This repo is not bound to a workspace. Nothing to do.");
      return;
    }

    fs.unlinkSync(configFile);

    // Clean up empty .glop/ directory
    try {
      const remaining = fs.readdirSync(glopDir);
      if (remaining.length === 0) {
        fs.rmdirSync(glopDir);
      }
    } catch {
      // Ignore cleanup errors
    }

    console.log("✓ Workspace binding removed. Hooks will no-op for this repo.");
  });

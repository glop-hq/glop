import { Command } from "commander";
import { execSync } from "child_process";

export const updateCommand = new Command("update")
  .description("Update glop to the latest version")
  .action(() => {
    console.log("Updating glop…");
    try {
      execSync("npm install -g glop.dev@latest", { stdio: "inherit" });
      const version = execSync("glop --version", { encoding: "utf-8" }).trim();
      console.log(`\nglop has been updated successfully to v${version}.`);
    } catch {
      process.exitCode = 1;
    }
  });

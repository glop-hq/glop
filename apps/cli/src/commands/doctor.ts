import { Command } from "commander";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoRoot, getRepoKey } from "../lib/git.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

type Status = "pass" | "fail" | "warn";

function check(status: Status, label: string, detail?: string) {
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "!";
  const line = `  ${icon} ${label}`;
  console.log(detail ? `${line} — ${detail}` : line);
  return status;
}

export const doctorCommand = new Command("doctor")
  .description("Check that glop is set up correctly")
  .action(async () => {
    let hasFailure = false;
    const fail = (label: string, detail?: string) => {
      hasFailure = true;
      return check("fail", label, detail);
    };

    // 1. Authenticated?
    const config = loadConfig();
    if (!config) {
      fail("Authenticated", "run `glop login` first");
      console.log();
      process.exit(1);
    }
    check("pass", "Authenticated", `${config.developer_name} on ${config.server_url}`);

    // 2. Server reachable + API key valid
    try {
      const res = await fetch(`${config.server_url}/api/v1/health`, {
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          "X-Machine-Id": config.machine_id,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        check("pass", "Server reachable");
      } else if (res.status === 401) {
        fail("API key valid", "re-run `glop login`");
      } else {
        fail("Server reachable", `HTTP ${res.status}`);
      }
    } catch {
      fail("Server reachable", `cannot connect to ${config.server_url}`);
    }

    // 3. Git repo
    const repoRoot = getRepoRoot();
    if (repoRoot) {
      check("pass", "Git repository", repoRoot);
    } else {
      check("warn", "Git repository", "not in a git repo");
    }

    // 4. Git remote
    if (repoRoot) {
      const repoKey = getRepoKey();
      if (repoKey) {
        check("pass", "Git remote", repoKey);
      } else {
        check("warn", "Git remote", "no origin remote found");
      }
    }

    // 5. Global hooks installed?
    const globalSettingsFile = path.join(os.homedir(), ".claude", "settings.json");

    if (fs.existsSync(globalSettingsFile)) {
      try {
        const settings = JSON.parse(fs.readFileSync(globalSettingsFile, "utf-8"));
        const hooks = settings.hooks || {};
        const glopEvents = Object.entries(hooks).filter(([, handlers]) =>
          JSON.stringify(handlers).includes("glop __hook")
        );
        if (glopEvents.length > 0) {
          check("pass", "Global hooks installed", `${glopEvents.length} events in ${globalSettingsFile}`);
        } else {
          fail("Global hooks installed", "run `glop login`");
        }
      } catch {
        fail("Global hooks installed", `${globalSettingsFile} is corrupted`);
      }
    } else {
      fail("Global hooks installed", "run `glop login`");
    }

    // 6. Repo bound to workspace?
    const repoBinding = loadRepoConfig();
    if (repoBinding) {
      check("pass", "Repo bound to workspace", repoBinding.workspace_id);
    } else if (repoRoot) {
      check("warn", "Repo bound to workspace", "run `glop link` to bind this repo");
    } else {
      check("warn", "Repo bound to workspace", "not in a git repo");
    }

    // 7. glop CLI in PATH
    try {
      const which = execSync("which glop", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      check("pass", "CLI in PATH", which);
    } catch {
      fail("CLI in PATH", "hooks won't fire — ensure `glop` is in your PATH");
    }

    // 8. GitHub CLI (gh) in PATH
    try {
      const ghWhich = execSync("which gh", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      check("pass", "GitHub CLI (gh)", ghWhich);
    } catch {
      check("warn", "GitHub CLI (gh)", "PR comment features won't work — install from https://cli.github.com");
    }

    console.log();
    if (hasFailure) {
      process.exit(1);
    } else {
      console.log("Everything looks good!");
    }
  });

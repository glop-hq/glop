import { Command } from "commander";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoRoot, getRepoKey, getBranch } from "../lib/git.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

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

    // 1. Config exists
    const config = loadConfig();
    if (!config) {
      fail("Authenticated", "run `glop auth` first");
      // Can't check anything else without config
      console.log();
      process.exit(1);
    }
    const repoBinding = loadRepoConfig();
    const wsSource = repoBinding?.workspace_id ? "repo binding" : "default";
    const authDetail = config.workspace_name
      ? `${config.developer_name} on ${config.server_url} (${config.workspace_name}, ${wsSource})`
      : `${config.developer_name} on ${config.server_url}`;
    check("pass", "Authenticated", authDetail);

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
        fail("API key valid", "re-run `glop auth`");
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

    // 5. Hooks installed in current repo
    const baseDir = repoRoot || process.cwd();
    const settingsFile = path.join(baseDir, ".claude", "settings.json");

    if (fs.existsSync(settingsFile)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
        const hooks = settings.hooks || {};
        const glopEvents = Object.entries(hooks).filter(([, handlers]) =>
          JSON.stringify(handlers).includes("glop __hook")
        );
        if (glopEvents.length > 0) {
          check("pass", "Hooks installed", `${glopEvents.length} events in ${settingsFile}`);
        } else {
          fail("Hooks installed", "run `glop init`");
        }
      } catch {
        fail("Hooks installed", `${settingsFile} is corrupted`);
      }
    } else {
      fail("Hooks installed", "run `glop init`");
    }

    // 6. glop CLI in PATH
    try {
      const which = execSync("which glop", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      check("pass", "CLI in PATH", which);
    } catch {
      fail("CLI in PATH", "hooks won't fire — ensure `glop` is in your PATH");
    }

    // 7. GitHub CLI (gh) in PATH — needed for PR comment features
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

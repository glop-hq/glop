import { execSync } from "child_process";

export function getRepoRoot(): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export function getRepoKey(): string | null {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Extract org/repo from various URL formats
    const match = remote.match(
      /(?:github\.com|gitlab\.com|bitbucket\.org)[/:](.+?)(?:\.git)?$/
    );
    if (match) return match[1];

    // Fallback: use last two path segments
    const parts = remote.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1].replace(".git", "")}`;
    }
    return remote;
  } catch {
    return null;
  }
}

export function getBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "main";
  }
}

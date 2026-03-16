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
    return "noname";
  }
}

export function getGitUserName(): string | null {
  try {
    return execSync("git config user.name", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || null;
  } catch {
    return null;
  }
}

export function getGitUserEmail(): string | null {
  try {
    return execSync("git config user.email", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || null;
  } catch {
    return null;
  }
}

export function getCommitDiffStats(): {
  files_changed: number;
  lines_added: number;
  lines_removed: number;
} | null {
  try {
    // git diff --shortstat HEAD~1 outputs like: " 3 files changed, 50 insertions(+), 10 deletions(-)"
    const output = execSync("git diff --shortstat HEAD~1", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 3000,
    }).trim();
    if (!output) return null;
    const files = output.match(/(\d+)\s+file/);
    const insertions = output.match(/(\d+)\s+insertion/);
    const deletions = output.match(/(\d+)\s+deletion/);
    return {
      files_changed: files ? parseInt(files[1], 10) : 0,
      lines_added: insertions ? parseInt(insertions[1], 10) : 0,
      lines_removed: deletions ? parseInt(deletions[1], 10) : 0,
    };
  } catch {
    return null;
  }
}

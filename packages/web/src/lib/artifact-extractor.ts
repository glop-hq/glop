/**
 * Extract commit and PR artifacts from PostToolUse Bash command output.
 */

export interface CommitArtifact {
  label: string;
  external_id: string;
  url: string | null;
}

export interface PrArtifact {
  url: string;
  label: string;
  external_id: string;
}

/** Extract combined output from a Bash tool_response ({stdout, stderr} object). */
export function extractBashOutput(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.stdout === "string") parts.push(r.stdout);
  if (typeof r.stderr === "string") parts.push(r.stderr);
  return parts.join("\n");
}

const COMMIT_PATTERN = /\[[\w/.-]+\s+([a-f0-9]{7,})\]\s+(.+)/;
const PR_URL_PATTERN = /(https:\/\/github\.com\/[^\s]+\/pull\/(\d+))/;

export function extractCommitArtifact(
  command: string,
  output: string,
  repoKey?: string
): CommitArtifact | null {
  if (!/\bgit\s+commit\b/.test(command)) return null;
  const match = output.match(COMMIT_PATTERN);
  if (!match) return null;
  const hash = match[1];
  const isGitHub = repoKey && /^[^/]+\/[^/]+$/.test(repoKey);
  return {
    external_id: hash,
    label: match[2],
    url: isGitHub ? `https://github.com/${repoKey}/commit/${hash}` : null,
  };
}

export function extractPrArtifact(
  command: string,
  output: string
): PrArtifact | null {
  if (!/\bgh\s+pr\s+create\b/.test(command)) return null;
  const match = output.match(PR_URL_PATTERN);
  if (!match) return null;
  return {
    url: match[1],
    label: match[1].replace("https://github.com/", ""),
    external_id: match[2],
  };
}

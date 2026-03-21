/**
 * Background worker that runs a repo readiness scan and submits results.
 * Invoked as a detached child process by the hook command on SessionStart.
 *
 * Args: serverUrl workspaceId repoRoot repoKey
 * Env: GLOP_API_KEY
 */

import { runDeterministicChecks } from "./scan-checks.js";
import { runQualityChecks } from "./scan-quality.js";

const [serverUrl, workspaceId, repoRoot, repoKey] = process.argv.slice(2);
const apiKey = process.env.GLOP_API_KEY;

if (!serverUrl || !apiKey || !workspaceId || !repoRoot || !repoKey) {
  process.exit(1);
}

async function main() {
  const startedAt = new Date().toISOString();

  const deterministicChecks = runDeterministicChecks(repoRoot);
  const qualityChecks = runQualityChecks(repoRoot);
  const allChecks = [...deterministicChecks, ...qualityChecks];
  const totalScore = allChecks.reduce((sum, c) => sum + c.score, 0);

  const completedAt = new Date().toISOString();

  await fetch(`${serverUrl}/api/v1/repos/scans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      repo_key: repoKey,
      score: totalScore,
      checks: allChecks,
      started_at: startedAt,
      completed_at: completedAt,
    }),
    signal: AbortSignal.timeout(15000),
  });
}

main().catch(() => process.exit(1));

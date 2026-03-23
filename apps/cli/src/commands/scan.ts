import { Command } from "commander";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoRoot, getRepoKey } from "../lib/git.js";
import { runDeterministicChecks, collectClaudeItems } from "../lib/scan-checks.js";
import { runQualityChecks } from "../lib/scan-quality.js";
import { extractDirectives } from "../lib/scan-directives.js";
import type { CheckResult } from "../lib/scan-checks.js";

export const scanCommand = new Command("scan")
  .description("Scan this repository for Claude Code readiness")
  .option("--no-quality", "Skip Claude-powered quality checks (deterministic only)")
  .option("--json", "Output results as JSON")
  .action(async (opts) => {
    const config = loadConfig();
    if (!config) {
      console.error("glop: not authenticated — run `glop login` first");
      process.exit(1);
    }

    const repoConfig = loadRepoConfig();
    if (!repoConfig) {
      console.error("glop: repo not linked — run `glop link` first");
      process.exit(1);
    }

    const repoRoot = getRepoRoot();
    if (!repoRoot) {
      console.error("glop: not in a git repository");
      process.exit(1);
    }

    const repoKey = getRepoKey() || "unknown";
    const startedAt = new Date().toISOString();

    // Run deterministic checks
    const deterministicChecks = runDeterministicChecks(repoRoot);

    // Run quality checks (Claude-powered) unless --no-quality
    let qualityChecks: CheckResult[] = [];
    if (opts.quality !== false) {
      if (!opts.json) {
        console.log("glop: running quality analysis with Claude...");
      }
      qualityChecks = runQualityChecks(repoRoot);
    }

    const allChecks = [...deterministicChecks, ...qualityChecks];
    const totalScore = allChecks.reduce((sum, c) => sum + c.score, 0);
    const completedAt = new Date().toISOString();

    // Output results
    if (opts.json) {
      console.log(
        JSON.stringify(
          { score: totalScore, checks: allChecks, repo_key: repoKey },
          null,
          2
        )
      );
    } else {
      const issueCount = allChecks.filter(
        (c) => c.status === "fail" || c.status === "warn"
      ).length;
      console.log(
        `glop: repo readiness score: ${totalScore}/100 (${issueCount} issue${issueCount !== 1 ? "s" : ""} found)`
      );
      console.log();

      for (const check of allChecks) {
        const icon =
          check.status === "pass"
            ? "✓"
            : check.status === "skip"
              ? "○"
              : check.status === "warn"
                ? "!"
                : "✗";
        console.log(
          `  ${icon} [${check.score}/${check.weight}] ${check.title}`
        );
        if (check.status !== "pass" && check.recommendation) {
          console.log(`    → ${check.recommendation}`);
        }
      }
      console.log();
    }

    // Collect Claude items (skills & commands)
    const claudeItems = collectClaudeItems(repoRoot);

    // Extract CLAUDE.md directives
    const directives = extractDirectives(repoRoot);

    // Submit results to server
    try {
      const body = {
        workspace_id: repoConfig.workspace_id,
        repo_key: repoKey,
        score: totalScore,
        checks: allChecks,
        claude_items: claudeItems,
        directives,
        started_at: startedAt,
        completed_at: completedAt,
      };

      const res = await fetch(`${config.server_url}/api/v1/repos/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        if (!opts.json) {
          console.log("glop: scan results submitted to server");
        }
      } else {
        if (!opts.json) {
          console.log(`glop: failed to submit scan results (HTTP ${res.status})`);
        }
      }
    } catch {
      if (!opts.json) {
        console.log("glop: could not reach server to submit scan results");
      }
    }
  });

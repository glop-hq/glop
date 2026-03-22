import { Command } from "commander";
import { execFileSync } from "child_process";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoKey } from "../lib/git.js";
import { buildRepoInsightPrompt } from "../lib/insight-prompts.js";

interface Facet {
  goal_categories: Record<string, number>;
  outcome: string;
  satisfaction: string;
  friction_counts: Record<string, number>;
  friction_detail: string | null;
  primary_success: string | null;
  files_touched: string[];
  area: string | null;
  brief_summary: string;
  duration_minutes: number | null;
  iteration_count: number | null;
  developer_id: string;
}

export const insightsCommand = new Command("insights")
  .description("Generate repo-level insights from session facets")
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

    const repoKey = getRepoKey() || "unknown";

    // Fetch facets from server (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      workspace_id: repoConfig.workspace_id,
      repo_key: repoKey,
      since,
    });

    console.log("glop: fetching session facets...");

    const facetsRes = await fetch(
      `${config.server_url}/api/v1/facets?${params}`,
      {
        headers: { Authorization: `Bearer ${config.api_key}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!facetsRes.ok) {
      console.error(`glop: failed to fetch facets (HTTP ${facetsRes.status})`);
      process.exit(1);
    }

    const { data: facets } = (await facetsRes.json()) as { data: Facet[] };

    if (facets.length < 5) {
      console.log(
        `glop: only ${facets.length} facets found — need at least 5 sessions to generate insights`
      );
      console.log(
        "glop: facets are automatically generated when sessions end. Keep using Claude Code!"
      );
      process.exit(0);
    }

    console.log(`glop: analyzing ${facets.length} sessions with Claude...`);

    // Aggregate stats
    const developerIds = new Set(facets.map((f) => f.developer_id));
    const outcomeDistribution: Record<string, number> = {};
    const frictionDistribution: Record<string, number> = {};
    const areaCounts: Record<string, number> = {};

    for (const facet of facets) {
      outcomeDistribution[facet.outcome] =
        (outcomeDistribution[facet.outcome] || 0) + 1;

      for (const [key, count] of Object.entries(facet.friction_counts)) {
        if (count > 0) {
          frictionDistribution[key] =
            (frictionDistribution[key] || 0) + count;
        }
      }

      if (facet.area) {
        areaCounts[facet.area] = (areaCounts[facet.area] || 0) + 1;
      }
    }

    const topAreas = Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([area, count]) => ({ area, count }));

    const sessionSummaries = facets.map((f) => f.brief_summary);
    const frictionDetails = facets
      .filter((f) => f.friction_detail)
      .map((f) => f.friction_detail!);

    // Run Claude to generate repo insight
    const prompt = buildRepoInsightPrompt(
      repoKey,
      {
        sessionCount: facets.length,
        developerCount: developerIds.size,
        outcomeDistribution,
        frictionDistribution,
        topAreas,
      },
      sessionSummaries,
      frictionDetails
    );

    try {
      const output = execFileSync("claude", ["-p", prompt, "--model", "haiku"], {
        encoding: "utf-8",
        timeout: 90000,
        maxBuffer: 1024 * 1024,
      }).trim();

      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("glop: could not parse Claude response");
        process.exit(1);
      }

      let insight: Record<string, unknown>;
      try {
        insight = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("glop: Claude returned invalid JSON");
        process.exit(1);
      }

      const periodEnd = new Date().toISOString().split("T")[0];
      const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Cherry-pick known fields — never spread raw LLM output
      const body = {
        workspace_id: repoConfig.workspace_id,
        repo_key: repoKey,
        period_start: periodStart,
        period_end: periodEnd,
        session_count: facets.length,
        developer_count: developerIds.size,
        outcome_distribution: outcomeDistribution,
        friction_analysis: insight.friction_analysis ?? [],
        success_patterns: insight.success_patterns ?? [],
        claude_md_suggestions: insight.claude_md_suggestions ?? [],
        file_coupling: insight.file_coupling ?? [],
        area_complexity: insight.area_complexity ?? [],
      };

      if (opts.json) {
        console.log(JSON.stringify(body, null, 2));
      }

      // Submit to server
      const submitRes = await fetch(
        `${config.server_url}/api/v1/repos/insights`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (submitRes.ok) {
        if (!opts.json) {
          console.log(
            `glop: repo insights generated from ${facets.length} sessions by ${developerIds.size} developer(s)`
          );
          console.log();

          // Print summary
          if (insight.friction_analysis?.length > 0) {
            console.log("  Friction hotspots:");
            for (const f of insight.friction_analysis.slice(0, 3)) {
              console.log(
                `    ! [${f.category}] ${f.area || "various"}: ${f.detail}`
              );
            }
            console.log();
          }

          if (insight.claude_md_suggestions?.length > 0) {
            console.log("  CLAUDE.md suggestions:");
            for (const s of insight.claude_md_suggestions.slice(0, 3)) {
              console.log(`    + ${s}`);
            }
            console.log();
          }

          console.log("glop: insights submitted to server");
        }
      } else {
        console.error(
          `glop: failed to submit insights (HTTP ${submitRes.status})`
        );
      }
    } catch {
      console.error(
        "glop: Claude CLI unavailable or failed — ensure `claude` is installed"
      );
      process.exit(1);
    }
  });

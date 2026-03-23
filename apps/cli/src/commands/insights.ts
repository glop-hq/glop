import { Command } from "commander";
import { execFileSync } from "child_process";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoKey } from "../lib/git.js";
import { buildRepoInsightPrompt } from "../lib/insight-prompts.js";
import { buildSuggestionPrompt } from "../lib/suggestion-prompts.js";

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

interface GlopConfig {
  server_url: string;
  api_key: string;
  machine_id: string;
  developer_id: string;
  developer_name: string;
}

/**
 * Generate smart suggestions from insight data + developer prompts.
 * Non-critical: failures are logged but don't fail the command.
 */
async function generateSuggestions(
  config: GlopConfig,
  repoId: string,
  repoKey: string,
  workspaceId: string,
  insight: Record<string, unknown>,
  json: boolean
): Promise<void> {
  if (!json) {
    console.log();
    console.log("glop: generating smart suggestions...");
  }

  // Fetch recent prompts for this repo
  const promptParams = new URLSearchParams({ limit: "200" });
  const promptsRes = await fetch(
    `${config.server_url}/api/v1/repos/${repoId}/prompts?${promptParams}`,
    {
      headers: { Authorization: `Bearer ${config.api_key}` },
      signal: AbortSignal.timeout(10000),
    }
  );

  let prompts: string[] = [];
  if (promptsRes.ok) {
    const promptData = (await promptsRes.json()) as {
      data: { prompts: string[] };
    };
    prompts = promptData.data.prompts;
  }

  // Fetch existing skills/commands to avoid duplicate suggestions
  let existingItems: Array<{ kind: string; name: string; content: string }> =
    [];
  try {
    const scanRes = await fetch(
      `${config.server_url}/api/v1/repos/${repoId}`,
      {
        headers: { Authorization: `Bearer ${config.api_key}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (scanRes.ok) {
      const scanData = (await scanRes.json()) as {
        data: {
          claude_items?: Array<{
            kind: string;
            name: string;
            content: string;
          }>;
        };
      };
      existingItems = scanData.data.claude_items ?? [];
    }
  } catch {
    // Non-critical — proceed without existing items
  }

  const suggestionPrompt = buildSuggestionPrompt(
    repoKey,
    prompts,
    {
      friction_analysis:
        (insight.friction_analysis as Array<{
          category: string;
          count: number;
          area: string | null;
          detail: string;
        }>) ?? [],
      success_patterns:
        (insight.success_patterns as Array<{
          pattern: string;
          area: string | null;
          detail: string;
        }>) ?? [],
      area_complexity:
        (insight.area_complexity as Array<{
          area: string;
          avg_iterations: number;
          avg_friction_count: number;
        }>) ?? [],
      file_coupling:
        (insight.file_coupling as Array<{
          files: string[];
          frequency: number;
        }>) ?? [],
      claude_md_suggestions:
        (insight.claude_md_suggestions as string[]) ?? [],
    },
    existingItems
  );

  const suggestionOutput = execFileSync(
    "claude",
    ["-p", suggestionPrompt, "--model", "haiku"],
    { encoding: "utf-8", timeout: 90000, maxBuffer: 1024 * 1024 }
  ).trim();

  const arrayMatch = suggestionOutput.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return;

  let rawSuggestions: Array<Record<string, unknown>>;
  try {
    rawSuggestions = JSON.parse(arrayMatch[0]);
  } catch {
    if (!json) {
      console.log("glop: could not parse suggestion response — skipping");
    }
    return;
  }

  if (rawSuggestions.length === 0) {
    if (!json) {
      console.log("glop: no suggestions generated (insufficient patterns)");
    }
    return;
  }

  // Cherry-pick known fields — never spread raw LLM output
  const cleanSuggestions = rawSuggestions
    .slice(0, 5)
    .map((s) => ({
      suggestion_type: String(s.suggestion_type || "skill"),
      title: String(s.title || "Untitled"),
      rationale: String(s.rationale || ""),
      draft_content: String(s.draft_content || ""),
      draft_filename: String(s.draft_filename || ""),
      pattern_type: String(s.pattern_type || "prompt_pattern"),
      pattern_data:
        typeof s.pattern_data === "object" && s.pattern_data !== null
          ? (s.pattern_data as Record<string, unknown>)
          : {},
    }))
    .filter(
      (s) =>
        ["skill", "command", "hook"].includes(s.suggestion_type) &&
        s.title.length > 0 &&
        s.draft_content.length > 0
    );

  if (cleanSuggestions.length === 0) return;

  const suggestRes = await fetch(
    `${config.server_url}/api/v1/repos/${repoId}/suggestions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        repo_key: repoKey,
        suggestions: cleanSuggestions,
      }),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (suggestRes.ok && !json) {
    const result = (await suggestRes.json()) as {
      data: { count: number; skipped: number };
    };
    console.log(`glop: generated ${result.data.count} suggestion(s)`);
    for (const s of cleanSuggestions.slice(0, 3)) {
      console.log(`    ★ [${s.suggestion_type}] ${s.title}`);
    }
    if (result.data.skipped > 0) {
      console.log(`    (${result.data.skipped} duplicate(s) skipped)`);
    }
  }
}

export const insightsCommand = new Command("insights")
  .description("Generate repo-level insights from session facets")
  .option("--json", "Output results as JSON")
  .option("--skip-suggestions", "Skip suggestion generation")
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

      if (!submitRes.ok) {
        console.error(
          `glop: failed to submit insights (HTTP ${submitRes.status})`
        );
        return;
      }

      const insightResponse = (await submitRes.json()) as {
        data: { id: string; repo_id?: string };
      };

      if (!opts.json) {
        console.log(
          `glop: repo insights generated from ${facets.length} sessions by ${developerIds.size} developer(s)`
        );
        console.log();

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

      // ── Suggestion Generation Phase ──────────────────────────────
      const repoId = insightResponse.data.repo_id;
      const hasFriction =
        Array.isArray(insight.friction_analysis) &&
        insight.friction_analysis.length >= 2;

      if (!opts.skipSuggestions && repoId && hasFriction) {
        try {
          await generateSuggestions(
            config,
            repoId,
            repoKey,
            repoConfig.workspace_id,
            insight,
            !!opts.json
          );
        } catch {
          if (!opts.json) {
            console.log(
              "glop: suggestion generation skipped (Claude unavailable)"
            );
          }
        }
      }
    } catch {
      console.error(
        "glop: Claude CLI unavailable or failed — ensure `claude` is installed"
      );
      process.exit(1);
    }
  });

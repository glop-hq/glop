import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { CheckResult } from "./scan-checks.js";

function readFileContent(repoRoot: string, ...segments: string[]): string | null {
  try {
    return fs.readFileSync(path.join(repoRoot, ...segments), "utf-8");
  } catch {
    return null;
  }
}

interface QualityScores {
  claude_md_quality: { score: number; reasoning: string };
  verification_setup: { score: number; reasoning: string };
  setup_instructions: { score: number; reasoning: string };
}

function buildPrompt(claudeMd: string | null, readme: string | null): string {
  const parts = [
    "You are evaluating a code repository for Claude Code readiness.",
    "Analyze the provided files and return a JSON object with scores.",
    "",
    "Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:",
    '{',
    '  "claude_md_quality": { "score": <0-15>, "reasoning": "<one sentence>" },',
    '  "verification_setup": { "score": <0-15>, "reasoning": "<one sentence>" },',
    '  "setup_instructions": { "score": <0-10>, "reasoning": "<one sentence>" }',
    '}',
    "",
    "Scoring criteria:",
    "",
    "claude_md_quality (0-15): Score the CLAUDE.md content depth.",
    "  0 = missing or empty",
    "  1-5 = exists but very thin (just a title or one sentence)",
    "  6-10 = has some useful info but missing key sections",
    "  11-15 = comprehensive: project description, conventions, build/test/lint commands, architecture notes",
    "",
    "verification_setup (0-15): Score whether lint/test/build commands are documented and seem runnable.",
    "  0 = no verification commands found anywhere",
    "  1-5 = commands mentioned but incomplete or unclear",
    "  6-10 = main commands documented (e.g. test command) but missing some",
    "  11-15 = comprehensive: lint, test, build, and type-check commands all clearly documented",
    "",
    "setup_instructions (0-10): Score setup/install instructions quality.",
    "  0 = no setup instructions found",
    "  1-3 = very basic (just 'npm install')",
    "  4-7 = covers install + some config but missing steps",
    "  8-10 = comprehensive: prerequisites, install, config, env setup, first run",
    "",
    "=== CLAUDE.md ===",
    claudeMd || "(file not found)",
    "",
    "=== README.md ===",
    readme ? readme.slice(0, 5000) : "(file not found)",
  ];
  return parts.join("\n");
}

function parseQualityResponse(output: string): QualityScores | null {
  try {
    // Try to extract JSON from the output (in case of extra text)
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clamp scores
    const clamp = (val: unknown, max: number): number => {
      const n = typeof val === "number" ? val : 0;
      return Math.max(0, Math.min(max, Math.round(n)));
    };

    return {
      claude_md_quality: {
        score: clamp(parsed.claude_md_quality?.score, 15),
        reasoning: String(parsed.claude_md_quality?.reasoning || ""),
      },
      verification_setup: {
        score: clamp(parsed.verification_setup?.score, 15),
        reasoning: String(parsed.verification_setup?.reasoning || ""),
      },
      setup_instructions: {
        score: clamp(parsed.setup_instructions?.score, 10),
        reasoning: String(parsed.setup_instructions?.reasoning || ""),
      },
    };
  } catch {
    return null;
  }
}

function skipResult(
  checkId: string,
  severity: "critical" | "warning",
  weight: number,
  title: string
): CheckResult {
  return {
    check_id: checkId,
    status: "skip",
    severity,
    weight,
    score: 0,
    title: `${title} (skipped)`,
    description:
      "This check requires Claude CLI but it was unavailable or failed.",
    recommendation: "Ensure the `claude` CLI is installed and accessible.",
    fix_available: false,
    details: { skipped: true },
  };
}

function qualityToCheck(
  checkId: string,
  severity: "critical" | "warning",
  weight: number,
  title: string,
  result: { score: number; reasoning: string },
  fixAvailable: boolean
): CheckResult {
  const pct = result.score / weight;
  const status: CheckResult["status"] =
    pct >= 0.7 ? "pass" : pct >= 0.4 ? "warn" : "fail";

  return {
    check_id: checkId,
    status,
    severity,
    weight,
    score: result.score,
    title:
      status === "pass"
        ? title
        : status === "warn"
          ? `${title} — needs improvement`
          : `${title} — insufficient`,
    description: result.reasoning || `Scored ${result.score}/${weight}.`,
    recommendation:
      status === "pass"
        ? null
        : `Improve this area to score higher. Current: ${result.score}/${weight}.`,
    fix_available: fixAvailable && status !== "pass",
    details: { score: result.score, max: weight },
  };
}

export function runQualityChecks(repoRoot: string): CheckResult[] {
  const claudeMd = readFileContent(repoRoot, "CLAUDE.md");
  const readme = readFileContent(repoRoot, "README.md");

  // If neither file exists, all quality checks fail with score 0
  if (!claudeMd && !readme) {
    return [
      {
        check_id: "claude_md_quality",
        status: "fail",
        severity: "critical",
        weight: 15,
        score: 0,
        title: "CLAUDE.md quality — insufficient",
        description: "No CLAUDE.md or README.md found to assess quality.",
        recommendation:
          "Add a CLAUDE.md with project description, conventions, and build/test/lint commands.",
        fix_available: true,
        details: {},
      },
      {
        check_id: "verification_setup",
        status: "fail",
        severity: "critical",
        weight: 15,
        score: 0,
        title: "Verification setup — insufficient",
        description: "No documentation found for lint/test/build commands.",
        recommendation:
          "Document lint, test, build, and type-check commands in CLAUDE.md.",
        fix_available: true,
        details: {},
      },
      {
        check_id: "setup_instructions",
        status: "fail",
        severity: "warning",
        weight: 10,
        score: 0,
        title: "Setup instructions — insufficient",
        description: "No setup or install instructions found.",
        recommendation:
          "Add setup instructions covering prerequisites, install, config, and first run.",
        fix_available: true,
        details: {},
      },
    ];
  }

  // Try Claude CLI
  try {
    const prompt = buildPrompt(claudeMd, readme);
    const output = execFileSync("claude", ["-p", prompt], {
      encoding: "utf-8",
      timeout: 90000,
      maxBuffer: 1024 * 1024,
    }).trim();

    const scores = parseQualityResponse(output);
    if (!scores) {
      // Claude responded but with unparseable output — skip
      return [
        skipResult("claude_md_quality", "critical", 15, "CLAUDE.md quality"),
        skipResult("verification_setup", "critical", 15, "Verification setup"),
        skipResult("setup_instructions", "warning", 10, "Setup instructions"),
      ];
    }

    return [
      qualityToCheck(
        "claude_md_quality",
        "critical",
        15,
        "CLAUDE.md quality",
        scores.claude_md_quality,
        true
      ),
      qualityToCheck(
        "verification_setup",
        "critical",
        15,
        "Verification setup",
        scores.verification_setup,
        true
      ),
      qualityToCheck(
        "setup_instructions",
        "warning",
        10,
        "Setup instructions",
        scores.setup_instructions,
        true
      ),
    ];
  } catch {
    // Claude CLI not available or timed out — skip quality checks
    return [
      skipResult("claude_md_quality", "critical", 15, "CLAUDE.md quality"),
      skipResult("verification_setup", "critical", 15, "Verification setup"),
      skipResult("setup_instructions", "warning", 10, "Setup instructions"),
    ];
  }
}

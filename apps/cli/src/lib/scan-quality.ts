import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { CheckResult } from "./scan-checks.js";
import { checkClaudeMdQuality, generateClaudeMdContent } from "./scan-claude-md.js";

function readFileContent(repoRoot: string, ...segments: string[]): string | null {
  try {
    return fs.readFileSync(path.join(repoRoot, ...segments), "utf-8");
  } catch {
    return null;
  }
}

interface QualityScores {
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
    '  "verification_setup": { "score": <0-10>, "reasoning": "<one sentence>" },',
    '  "setup_instructions": { "score": <0-5>, "reasoning": "<one sentence>" }',
    '}',
    "",
    "Scoring criteria:",
    "",
    "verification_setup (0-10): Score whether lint/test/build commands are documented and seem runnable.",
    "  0 = no verification commands found anywhere",
    "  1-3 = commands mentioned but incomplete or unclear",
    "  4-7 = main commands documented (e.g. test command) but missing some",
    "  8-10 = comprehensive: lint, test, build, and type-check commands all clearly documented",
    "",
    "setup_instructions (0-5): Score setup/install instructions quality.",
    "  0 = no setup instructions found",
    "  1-2 = very basic (just 'npm install')",
    "  3-4 = covers install + some config but missing steps",
    "  5 = comprehensive: prerequisites, install, config, env setup, first run",
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
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    const clamp = (val: unknown, max: number): number => {
      const n = typeof val === "number" ? val : 0;
      return Math.max(0, Math.min(max, Math.round(n)));
    };

    return {
      verification_setup: {
        score: clamp(parsed.verification_setup?.score, 10),
        reasoning: String(parsed.verification_setup?.reasoning || ""),
      },
      setup_instructions: {
        score: clamp(parsed.setup_instructions?.score, 5),
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

  // 1. CLAUDE.md deep quality scoring (deterministic — no Claude CLI needed)
  const claudeMdCheck = checkClaudeMdQuality(repoRoot, 10);

  // If claude_md_quality fails and fix is available, generate suggested content
  if (claudeMdCheck.status !== "pass") {
    const suggestedContent = generateClaudeMdContent(repoRoot);
    (claudeMdCheck.details as Record<string, unknown>).suggested_content = suggestedContent;
  }

  // If neither file exists, skip AI quality checks
  if (!claudeMd && !readme) {
    return [
      claudeMdCheck,
      {
        check_id: "verification_setup",
        status: "fail",
        severity: "critical",
        weight: 10,
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
        weight: 5,
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

  // 2. AI-powered checks for verification_setup and setup_instructions
  try {
    const prompt = buildPrompt(claudeMd, readme);
    const output = execFileSync("claude", ["-p", prompt], {
      encoding: "utf-8",
      timeout: 90000,
      maxBuffer: 1024 * 1024,
    }).trim();

    const scores = parseQualityResponse(output);
    if (!scores) {
      return [
        claudeMdCheck,
        skipResult("verification_setup", "critical", 10, "Verification setup"),
        skipResult("setup_instructions", "warning", 5, "Setup instructions"),
      ];
    }

    return [
      claudeMdCheck,
      qualityToCheck(
        "verification_setup",
        "critical",
        10,
        "Verification setup",
        scores.verification_setup,
        true
      ),
      qualityToCheck(
        "setup_instructions",
        "warning",
        5,
        "Setup instructions",
        scores.setup_instructions,
        true
      ),
    ];
  } catch {
    return [
      claudeMdCheck,
      skipResult("verification_setup", "critical", 10, "Verification setup"),
      skipResult("setup_instructions", "warning", 5, "Setup instructions"),
    ];
  }
}

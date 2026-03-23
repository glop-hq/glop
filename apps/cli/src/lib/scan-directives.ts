import type { CheckResult } from "./scan-checks.js";
import { findClaudeMdFiles } from "./scan-utils.js";

// ── Directive extraction ────────────────────────────────

export interface ExtractedDirective {
  directive: string;
  source_file: string;
  source_line: number;
  category: string;
}

type DirectiveCategory = "testing" | "architecture" | "conventions" | "tooling" | "workflow" | "general";

function categorizeDirective(text: string): DirectiveCategory {
  const lower = text.toLowerCase();

  if (/\b(?:test|spec|jest|vitest|pytest|mocha|cypress|playwright)\b/.test(lower)) return "testing";
  if (/\b(?:build|compile|lint|format|prettier|eslint|type.?check|tsc)\b/.test(lower)) return "tooling";
  if (/\b(?:architecture|structure|directory|folder|module|component|service|layer)\b/.test(lower)) return "architecture";
  if (/\b(?:naming|convention|style|pattern|prefer|avoid|always|never|use|don't|do not)\b/.test(lower)) return "conventions";
  if (/\b(?:commit|push|deploy|review|merge|branch|pr|pull request)\b/.test(lower)) return "workflow";

  return "general";
}

function isDirectiveLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 10 || trimmed.length > 500) return false;

  // Bullet point or numbered list items with actionable content
  if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
    const content = trimmed.replace(/^[-*+]\s+|^\d+\.\s+/, "");
    // Must contain some actionable verb or pattern
    if (/^(?:use|run|add|create|ensure|always|never|don't|do not|avoid|prefer|include|make sure|check|verify|set|configure|install|update|keep|follow|write|test|build|lint|format)\b/i.test(content)) {
      return true;
    }
    // Contains a command in backticks
    if (/`[^`]+`/.test(content) && content.length > 15) {
      return true;
    }
  }

  // Imperative sentences (not inside headings or code blocks)
  if (!trimmed.startsWith("#") && !trimmed.startsWith("```")) {
    if (/^(?:Always|Never|Don't|Do not|Make sure|Ensure|Use|Run|Avoid|Prefer|Before|After|When)\b/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

export function extractDirectives(repoRoot: string): ExtractedDirective[] {
  const files = findClaudeMdFiles(repoRoot);
  const directives: ExtractedDirective[] = [];

  for (const file of files) {
    const lines = file.content.split("\n");
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      if (isDirectiveLine(line)) {
        const text = line.trim().replace(/^[-*+]\s+|^\d+\.\s+/, "").trim();
        directives.push({
          directive: text,
          source_file: file.path,
          source_line: i + 1,
          category: categorizeDirective(text),
        });
      }
    }
  }

  return directives;
}

// ── Compliance check ────────────────────────────────────

export function checkClaudeMdCompliance(repoRoot: string): CheckResult {
  const directives = extractDirectives(repoRoot);

  if (directives.length === 0) {
    return {
      check_id: "claude_md_compliance",
      status: "fail",
      severity: "warning",
      weight: 10,
      score: 0,
      title: "No CLAUDE.md directives found",
      description: "No actionable directives could be extracted from CLAUDE.md files. Without clear instructions, compliance cannot be measured.",
      recommendation: "Add specific, actionable directives to CLAUDE.md (e.g., 'Run `pnpm test` before committing', 'Use factory pattern in src/auth/').",
      fix_available: true,
      details: { directive_count: 0, directives: [] },
    };
  }

  // Score based on directive quality and coverage
  const categories = new Set(directives.map((d) => d.category));
  const categoryCount = categories.size;

  // More categories = better coverage
  let score: number;
  if (categoryCount >= 4) score = 10;
  else if (categoryCount >= 3) score = 8;
  else if (categoryCount >= 2) score = 6;
  else score = 4;

  // Bonus for having enough directives (minimum threshold)
  if (directives.length < 3) score = Math.min(score, 4);
  if (directives.length < 2) score = Math.min(score, 2);

  const pct = score / 10;
  const status: CheckResult["status"] =
    pct >= 0.7 ? "pass" : pct >= 0.4 ? "warn" : "fail";

  const missingCategories = ["testing", "architecture", "conventions", "tooling"]
    .filter((c) => !categories.has(c));

  return {
    check_id: "claude_md_compliance",
    status,
    severity: "warning",
    weight: 10,
    score,
    title: status === "pass"
      ? `${directives.length} CLAUDE.md directives tracked`
      : `CLAUDE.md compliance — ${missingCategories.length} category gaps`,
    description: `Found ${directives.length} directive(s) across ${categoryCount} categories: ${[...categories].join(", ")}.`,
    recommendation: missingCategories.length > 0
      ? `Add directives for: ${missingCategories.join(", ")}. E.g., testing commands, architecture rules, coding conventions.`
      : null,
    fix_available: status !== "pass",
    details: {
      directive_count: directives.length,
      categories: [...categories],
      missing_categories: missingCategories,
      directives: directives.slice(0, 20), // Limit for payload size
    },
  };
}

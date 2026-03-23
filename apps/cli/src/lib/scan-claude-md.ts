import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import type { CheckResult } from "./scan-checks.js";
import { findClaudeMdFiles as findFiles, readFileSafe } from "./scan-utils.js";

// ── Sub-dimension interfaces ────────────────────────────

export interface ClaudeMdSubScores {
  length: number; // 0-20
  freshness: number; // 0-20
  structure: number; // 0-20
  specificity: number; // 0-20
  completeness: number; // 0-20
  total: number; // 0-100
}

interface ClaudeMdFile {
  path: string;
  content: string;
  lines: string[];
}

function findClaudeMdFiles(repoRoot: string): ClaudeMdFile[] {
  return findFiles(repoRoot).map((f) => ({
    ...f,
    lines: f.content.split("\n"),
  }));
}

// ── Sub-dimension scorers ───────────────────────────────

function scoreLength(files: ClaudeMdFile[]): number {
  const totalLines = files.reduce((sum, f) => sum + f.lines.length, 0);
  if (totalLines === 0) return 0;
  if (totalLines < 10) return 5;
  if (totalLines <= 50) return 10;
  if (totalLines <= 150) return 15;
  if (totalLines <= 500) return 20;
  return 20; // >500 still gets max
}

function scoreFreshness(repoRoot: string, files: ClaudeMdFile[]): number {
  if (files.length === 0) return 0;

  try {
    // Get last CLAUDE.md modification date from git
    const claudeMdPaths = files.map((f) => f.path);
    const lastClaudeMdCommit = execFileSync(
      "git",
      ["log", "-1", "--format=%ct", "--", ...claudeMdPaths],
      { cwd: repoRoot, encoding: "utf-8", timeout: 10000 }
    ).trim();

    // Get last repo commit date
    const lastRepoCommit = execFileSync(
      "git",
      ["log", "-1", "--format=%ct"],
      { cwd: repoRoot, encoding: "utf-8", timeout: 10000 }
    ).trim();

    if (!lastClaudeMdCommit || !lastRepoCommit) {
      return scoreFreshnessByMtime(repoRoot, files);
    }

    const claudeMdTs = parseInt(lastClaudeMdCommit, 10) * 1000;
    const repoTs = parseInt(lastRepoCommit, 10) * 1000;

    // Freshness is relative: days between last repo commit and last CLAUDE.md update
    const lagDays = (repoTs - claudeMdTs) / (1000 * 60 * 60 * 24);

    // If CLAUDE.md was updated after or at the same time as the last repo commit, it's fresh
    if (lagDays < 7) return 20;
    if (lagDays < 30) return 15;
    if (lagDays < 90) return 10;
    if (lagDays < 180) return 5;
    return 0;
  } catch {
    return scoreFreshnessByMtime(repoRoot, files);
  }
}

function scoreFreshnessByMtime(repoRoot: string, files: ClaudeMdFile[]): number {
  try {
    let latestMtime = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(repoRoot, f.path));
      if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
    }
    if (latestMtime === 0) return 0;
    const daysSinceUpdate = (Date.now() - latestMtime) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) return 20;
    if (daysSinceUpdate < 30) return 15;
    if (daysSinceUpdate < 90) return 10;
    if (daysSinceUpdate < 180) return 5;
    return 0;
  } catch {
    return 0;
  }
}

function scoreStructure(files: ClaudeMdFile[]): number {
  if (files.length === 0) return 0;

  let score = 0;
  const allContent = files.map((f) => f.content).join("\n");
  const allLines = allContent.split("\n");

  // Headings (up to 6 points)
  const headingCount = allLines.filter((l) => /^#{1,6}\s/.test(l)).length;
  score += Math.min(6, headingCount * 2);

  // Lists - bullet or numbered (up to 4 points)
  const listCount = allLines.filter((l) => /^\s*[-*+]\s|^\s*\d+\.\s/.test(l)).length;
  score += Math.min(4, Math.floor(listCount / 2));

  // Code blocks or inline code (up to 4 points)
  const codeBlockCount = (allContent.match(/```/g) || []).length / 2;
  const inlineCodeCount = allLines.filter((l) => /`[^`]+`/.test(l)).length;
  score += Math.min(4, Math.floor(codeBlockCount) + Math.min(2, Math.floor(inlineCodeCount / 3)));

  // .claude/rules/ usage (up to 3 points)
  const ruleFiles = files.filter((f) => f.path.startsWith(".claude/rules/"));
  score += Math.min(3, ruleFiles.length);

  // Multiple CLAUDE.md files (nested) (up to 3 points)
  const claudeMdFiles = files.filter((f) => f.path.endsWith("CLAUDE.md"));
  if (claudeMdFiles.length > 1) {
    score += Math.min(3, claudeMdFiles.length - 1);
  }

  return Math.min(20, score);
}

function scoreSpecificity(files: ClaudeMdFile[]): number {
  if (files.length === 0) return 0;

  const allLines = files.flatMap((f) => f.lines).filter((l) => l.trim().length > 0);
  if (allLines.length === 0) return 0;

  let specificLines = 0;

  for (const line of allLines) {
    // File paths (e.g., src/auth/, ./config, packages/web)
    if (/(?:^|\s)(?:\.?\/)?(?:src|lib|app|packages|apps|config|test|spec)\/\S+/.test(line)) {
      specificLines++;
      continue;
    }
    // Command names (e.g., `pnpm test`, `npm run build`, `make`)
    if (/`[^`]*(?:pnpm|npm|yarn|cargo|make|go |pytest|jest|vitest|eslint|prettier)\s*[^`]*`/.test(line)) {
      specificLines++;
      continue;
    }
    // File extensions or specific patterns
    if (/\.\w{1,4}\b/.test(line) && /(?:\.ts|\.tsx|\.js|\.py|\.go|\.rs|\.json|\.yaml|\.yml|\.toml)/.test(line)) {
      specificLines++;
      continue;
    }
    // Specific class/function/variable names (camelCase or PascalCase references)
    if (/\b[A-Z][a-zA-Z]+(?:Service|Controller|Provider|Factory|Handler|Manager|Client|Store)\b/.test(line)) {
      specificLines++;
      continue;
    }
  }

  const ratio = specificLines / allLines.length;
  if (ratio >= 0.5) return 20;
  if (ratio >= 0.35) return 15;
  if (ratio >= 0.2) return 10;
  if (ratio >= 0.1) return 5;
  return 2; // some content but very generic
}

function scoreCompleteness(files: ClaudeMdFile[]): number {
  if (files.length === 0) return 0;

  const allContent = files.map((f) => f.content.toLowerCase()).join("\n");
  let score = 0;

  // Testing commands (4 points)
  if (/\b(?:test|jest|vitest|pytest|cargo test|go test|spec|mocha)\b/.test(allContent) &&
      /`[^`]*(?:test|spec)[^`]*`/.test(allContent)) {
    score += 4;
  }

  // Build commands (4 points)
  if (/\b(?:build|compile|bundle|webpack|vite|esbuild|tsc|cargo build|go build)\b/.test(allContent) &&
      /`[^`]*(?:build|compile)[^`]*`/.test(allContent)) {
    score += 4;
  }

  // Architecture notes (4 points)
  if (/(?:architecture|structure|directory|folder|layout|overview|component)/i.test(allContent) &&
      /(?:src\/|lib\/|app\/|packages\/|modules\/)/.test(allContent)) {
    score += 4;
  }

  // Coding conventions (4 points)
  if (/(?:convention|style|pattern|naming|format|lint|prettier|eslint)/i.test(allContent)) {
    score += 4;
  }

  // Area-specific rules (4 points)
  const hasAreaRules = files.some((f) => f.path.startsWith(".claude/rules/")) ||
    /(?:when (?:modifying|editing|working|changing)|in (?:src\/|lib\/|app\/))/i.test(allContent);
  if (hasAreaRules) {
    score += 4;
  }

  return Math.min(20, score);
}

// ── Main scoring function ───────────────────────────────

export function analyzeClaudeMd(repoRoot: string): ClaudeMdSubScores {
  const files = findClaudeMdFiles(repoRoot);

  if (files.length === 0) {
    return { length: 0, freshness: 0, structure: 0, specificity: 0, completeness: 0, total: 0 };
  }

  const length = scoreLength(files);
  const freshness = scoreFreshness(repoRoot, files);
  const structure = scoreStructure(files);
  const specificity = scoreSpecificity(files);
  const completeness = scoreCompleteness(files);
  const total = length + freshness + structure + specificity + completeness;

  return { length, freshness, structure, specificity, completeness, total };
}

// ── Check result builder ────────────────────────────────

export function checkClaudeMdQuality(repoRoot: string, weight: number): CheckResult {
  const scores = analyzeClaudeMd(repoRoot);
  const normalizedScore = Math.round((scores.total / 100) * weight);
  const pct = normalizedScore / weight;

  const status: CheckResult["status"] =
    pct >= 0.7 ? "pass" : pct >= 0.4 ? "warn" : "fail";

  const lowDimensions = [];
  if (scores.length < 10) lowDimensions.push(`length (${scores.length}/20)`);
  if (scores.freshness < 10) lowDimensions.push(`freshness (${scores.freshness}/20)`);
  if (scores.structure < 10) lowDimensions.push(`structure (${scores.structure}/20)`);
  if (scores.specificity < 10) lowDimensions.push(`specificity (${scores.specificity}/20)`);
  if (scores.completeness < 10) lowDimensions.push(`completeness (${scores.completeness}/20)`);

  const description = status === "pass"
    ? `CLAUDE.md quality is strong (${scores.total}/100). Sub-scores: length=${scores.length}, freshness=${scores.freshness}, structure=${scores.structure}, specificity=${scores.specificity}, completeness=${scores.completeness}.`
    : `CLAUDE.md quality score: ${scores.total}/100. Weak areas: ${lowDimensions.join(", ")}.`;

  const recommendation = status === "pass"
    ? null
    : lowDimensions.length > 0
      ? `Improve these CLAUDE.md dimensions: ${lowDimensions.join(", ")}. Add file paths, commands, and area-specific rules for higher specificity.`
      : `Improve CLAUDE.md content depth. Current score: ${scores.total}/100.`;

  return {
    check_id: "claude_md_quality",
    status,
    severity: "critical",
    weight,
    score: normalizedScore,
    title: status === "pass"
      ? "CLAUDE.md quality"
      : status === "warn"
        ? "CLAUDE.md quality — needs improvement"
        : "CLAUDE.md quality — insufficient",
    description,
    recommendation,
    fix_available: status !== "pass",
    details: {
      sub_scores: scores,
      score: normalizedScore,
      max: weight,
    },
  };
}

// ── Auto-generation ─────────────────────────────────────

interface CodebaseAnalysis {
  packageManager: string | null;
  scripts: Record<string, string>;
  keyDirectories: string[];
  hasCI: boolean;
  ciFiles: string[];
  readmeExcerpt: string | null;
  language: string | null;
}

function analyzeCodebase(repoRoot: string): CodebaseAnalysis {
  const result: CodebaseAnalysis = {
    packageManager: null,
    scripts: {},
    keyDirectories: [],
    hasCI: false,
    ciFiles: [],
    readmeExcerpt: null,
    language: null,
  };

  // Package manager & scripts
  const pkgJson = readFileSafe(path.join(repoRoot, "package.json"));
  if (pkgJson) {
    try {
      const pkg = JSON.parse(pkgJson);
      result.scripts = pkg.scripts || {};
      if (fs.existsSync(path.join(repoRoot, "pnpm-lock.yaml"))) result.packageManager = "pnpm";
      else if (fs.existsSync(path.join(repoRoot, "yarn.lock"))) result.packageManager = "yarn";
      else result.packageManager = "npm";
      result.language = "TypeScript/JavaScript";
    } catch { /* ignore */ }
  }

  const pyProject = readFileSafe(path.join(repoRoot, "pyproject.toml"));
  if (pyProject) {
    result.language = result.language || "Python";
  }

  const cargoToml = readFileSafe(path.join(repoRoot, "Cargo.toml"));
  if (cargoToml) {
    result.language = result.language || "Rust";
  }

  // Key directories
  try {
    const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") continue;
      if (["src", "lib", "app", "packages", "apps", "api", "config", "test", "tests", "docs"].includes(entry.name)) {
        result.keyDirectories.push(entry.name);
      }
    }
  } catch { /* ignore */ }

  // CI config
  const ghWorkflows = path.join(repoRoot, ".github", "workflows");
  try {
    if (fs.statSync(ghWorkflows).isDirectory()) {
      result.hasCI = true;
      result.ciFiles = fs.readdirSync(ghWorkflows).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    }
  } catch { /* ignore */ }

  // README excerpt
  const readme = readFileSafe(path.join(repoRoot, "README.md"));
  if (readme) {
    // First paragraph after the title
    const lines = readme.split("\n");
    const titleIdx = lines.findIndex((l) => /^#\s/.test(l));
    if (titleIdx >= 0) {
      const remaining = lines.slice(titleIdx + 1).join("\n").trim();
      const firstParagraph = remaining.split("\n\n")[0]?.trim();
      if (firstParagraph) {
        result.readmeExcerpt = firstParagraph.slice(0, 300);
      }
    }
  }

  return result;
}

export function generateClaudeMdContent(repoRoot: string): string {
  const analysis = analyzeCodebase(repoRoot);
  const sections: string[] = [];

  // Project overview
  sections.push("# Project Overview");
  if (analysis.readmeExcerpt) {
    sections.push(analysis.readmeExcerpt);
  } else {
    sections.push("[Add a brief project description here]");
  }

  // Key commands
  sections.push("\n# Key Commands");
  const pm = analysis.packageManager || "npm";
  const pmRun = pm === "npm" ? "npm run" : pm;
  if (analysis.scripts.test) sections.push(`- Test: \`${pmRun} test\``);
  if (analysis.scripts.lint) sections.push(`- Lint: \`${pmRun} lint\``);
  if (analysis.scripts.build) sections.push(`- Build: \`${pmRun} build\``);
  if (analysis.scripts.typecheck || analysis.scripts["type-check"]) {
    sections.push(`- Type check: \`${pmRun} ${analysis.scripts.typecheck ? "typecheck" : "type-check"}\``);
  }
  if (Object.keys(analysis.scripts).length === 0) {
    sections.push("- [Add test, lint, and build commands here]");
  }

  // Architecture
  if (analysis.keyDirectories.length > 0) {
    sections.push("\n# Architecture");
    for (const dir of analysis.keyDirectories) {
      sections.push(`- \`${dir}/\` — [describe purpose]`);
    }
  }

  // Coding conventions
  sections.push("\n# Coding Conventions");
  sections.push("- [Add naming conventions, patterns, and style rules here]");

  // Area-specific rules
  sections.push("\n# Area-Specific Rules");
  sections.push("- [Add rules for specific directories or file types here]");

  return sections.join("\n") + "\n";
}

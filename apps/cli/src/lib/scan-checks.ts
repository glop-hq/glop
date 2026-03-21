import fs from "fs";
import path from "path";

export interface CheckResult {
  check_id: string;
  status: "pass" | "warn" | "fail" | "skip";
  severity: "critical" | "warning" | "info";
  weight: number;
  score: number;
  title: string;
  description: string;
  recommendation: string | null;
  fix_available: boolean;
  details: Record<string, unknown>;
}

function fileExists(repoRoot: string, ...segments: string[]): boolean {
  return fs.existsSync(path.join(repoRoot, ...segments));
}

function readFile(repoRoot: string, ...segments: string[]): string | null {
  const filePath = path.join(repoRoot, ...segments);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function dirHasFiles(repoRoot: string, ...segments: string[]): string[] {
  const dirPath = path.join(repoRoot, ...segments);
  try {
    if (!fs.statSync(dirPath).isDirectory()) return [];
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith("."));
  } catch {
    return [];
  }
}

// ── Check: CLAUDE.md exists ────────────────────────────

export function checkClaudeMdExists(repoRoot: string): CheckResult {
  const exists = fileExists(repoRoot, "CLAUDE.md");
  return {
    check_id: "claude_md_exists",
    status: exists ? "pass" : "fail",
    severity: "critical",
    weight: 20,
    score: exists ? 20 : 0,
    title: exists ? "CLAUDE.md found" : "Missing CLAUDE.md",
    description: exists
      ? "Repository has a CLAUDE.md file at the root."
      : "No CLAUDE.md file found. Without it, Claude Code lacks context about project architecture, conventions, and commands.",
    recommendation: exists
      ? null
      : "Add a CLAUDE.md to the repo root describing the project, tech stack, build/test/lint commands, and coding conventions.",
    fix_available: !exists,
    details: { path: "CLAUDE.md", exists },
  };
}

// ── Check: Skills defined ──────────────────────────────

export function checkSkillsDefined(repoRoot: string): CheckResult {
  const files = dirHasFiles(repoRoot, ".claude", "skills");
  const hasSkills = files.length > 0;
  return {
    check_id: "skills_defined",
    status: hasSkills ? "pass" : "fail",
    severity: "warning",
    weight: 10,
    score: hasSkills ? 10 : 0,
    title: hasSkills
      ? `${files.length} skill${files.length > 1 ? "s" : ""} defined`
      : "No custom skills",
    description: hasSkills
      ? `Found ${files.length} skill file(s) in .claude/skills/.`
      : "No .claude/skills/ directory or skill files found. Custom skills help Claude perform repo-specific workflows consistently.",
    recommendation: hasSkills
      ? null
      : "Create .claude/skills/ with skill files for common workflows like code review, testing, or deployment.",
    fix_available: !hasSkills,
    details: { skill_files: files },
  };
}

// ── Check: Hooks configured ────────────────────────────

export function checkHooksConfigured(repoRoot: string): CheckResult {
  const settingsContent = readFile(repoRoot, ".claude", "settings.json");
  let hasHooks = false;
  if (settingsContent) {
    try {
      const settings = JSON.parse(settingsContent);
      hasHooks = !!(settings.hooks && Object.keys(settings.hooks).length > 0);
    } catch {
      // invalid JSON
    }
  }

  // Also check for .claude/hooks/ directory
  if (!hasHooks) {
    const hookFiles = dirHasFiles(repoRoot, ".claude", "hooks");
    hasHooks = hookFiles.length > 0;
  }

  return {
    check_id: "hooks_configured",
    status: hasHooks ? "pass" : "fail",
    severity: "warning",
    weight: 10,
    score: hasHooks ? 10 : 0,
    title: hasHooks ? "Hooks configured" : "No hooks configured",
    description: hasHooks
      ? "Claude Code hooks are configured for this repo."
      : "No hooks found in .claude/settings.json or .claude/hooks/. Hooks enable automated verification steps like linting and testing.",
    recommendation: hasHooks
      ? null
      : "Configure hooks in .claude/settings.json to run lint, test, or type-check automatically.",
    fix_available: !hasHooks,
    details: { has_hooks: hasHooks },
  };
}

// ── Check: Claude settings ─────────────────────────────

export function checkClaudeSettings(repoRoot: string): CheckResult {
  const exists = fileExists(repoRoot, ".claude", "settings.json");
  return {
    check_id: "claude_settings",
    status: exists ? "pass" : "fail",
    severity: "info",
    weight: 5,
    score: exists ? 5 : 0,
    title: exists ? "Claude settings configured" : "No Claude settings",
    description: exists
      ? ".claude/settings.json is present with project-specific configuration."
      : "No .claude/settings.json found. This file configures permissions and project-specific Claude behavior.",
    recommendation: exists
      ? null
      : "Create .claude/settings.json with appropriate permission settings for this project.",
    fix_available: !exists,
    details: { exists },
  };
}

// ── Check: Test paths ──────────────────────────────────

export function checkTestPaths(repoRoot: string): CheckResult {
  const testIndicators: string[] = [];

  // Check for common test directories
  for (const dir of ["test", "tests", "__tests__", "spec", "specs"]) {
    if (fileExists(repoRoot, dir)) testIndicators.push(dir + "/");
  }

  // Check for test files in src/ (sampling approach)
  try {
    const findTestFiles = (dir: string, depth: number): void => {
      if (depth > 3) return;
      const entries = fs.readdirSync(path.join(repoRoot, dir), {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        if (entry.isFile() && /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs)$/.test(entry.name)) {
          testIndicators.push(path.join(dir, entry.name));
          if (testIndicators.length >= 5) return;
        }
        if (entry.isDirectory() && testIndicators.length < 5) {
          findTestFiles(path.join(dir, entry.name), depth + 1);
        }
      }
    };
    if (fileExists(repoRoot, "src")) findTestFiles("src", 0);
    if (fileExists(repoRoot, "packages")) findTestFiles("packages", 0);
  } catch {
    // ignore traversal errors
  }

  const hasTests = testIndicators.length > 0;
  return {
    check_id: "test_paths",
    status: hasTests ? "pass" : "fail",
    severity: "warning",
    weight: 5,
    score: hasTests ? 5 : 0,
    title: hasTests ? "Test files found" : "No test files detected",
    description: hasTests
      ? `Found test indicators: ${testIndicators.slice(0, 5).join(", ")}.`
      : "No test files or test directories found. Tests help Claude verify its changes.",
    recommendation: hasTests
      ? null
      : "Add test files and document test commands in CLAUDE.md so Claude can verify changes.",
    fix_available: false,
    details: { test_indicators: testIndicators.slice(0, 10) },
  };
}

// ── Check: Local docs ──────────────────────────────────

export function checkLocalDocs(repoRoot: string): CheckResult {
  const docIndicators: string[] = [];

  if (fileExists(repoRoot, "docs")) docIndicators.push("docs/");
  for (const file of [
    "ARCHITECTURE.md",
    "API.md",
    "CONTRIBUTING.md",
    "DEVELOPMENT.md",
    "DESIGN.md",
  ]) {
    if (fileExists(repoRoot, file)) docIndicators.push(file);
  }

  const hasDocs = docIndicators.length > 0;
  return {
    check_id: "local_docs",
    status: hasDocs ? "pass" : "fail",
    severity: "info",
    weight: 5,
    score: hasDocs ? 5 : 0,
    title: hasDocs ? "Documentation found" : "No additional documentation",
    description: hasDocs
      ? `Found: ${docIndicators.join(", ")}.`
      : "No docs/ directory or architecture documentation found.",
    recommendation: hasDocs
      ? null
      : "Consider adding docs/ or an ARCHITECTURE.md to help Claude understand the project structure.",
    fix_available: false,
    details: { doc_indicators: docIndicators },
  };
}

// ── Check: Repo structure ──────────────────────────────

export function checkRepoStructure(repoRoot: string): CheckResult {
  const issues: string[] = [];
  let largeFiles = 0;

  try {
    const checkDir = (dir: string, depth: number): void => {
      if (depth > 4 || largeFiles > 5) return;
      const entries = fs.readdirSync(path.join(repoRoot, dir), {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "build" ||
          entry.name === ".next"
        )
          continue;
        const rel = path.join(dir, entry.name);
        if (entry.isFile()) {
          try {
            const stat = fs.statSync(path.join(repoRoot, rel));
            if (stat.size > 500 * 1024) {
              largeFiles++;
              issues.push(`${rel} (${Math.round(stat.size / 1024)}KB)`);
            }
          } catch {
            // skip
          }
        } else if (entry.isDirectory()) {
          checkDir(rel, depth + 1);
        }
      }
    };
    checkDir("", 0);
  } catch {
    // ignore errors
  }

  const isClean = issues.length === 0;
  return {
    check_id: "repo_structure",
    status: isClean ? "pass" : "warn",
    severity: "info",
    weight: 5,
    score: isClean ? 5 : 2,
    title: isClean ? "Clean repo structure" : `${issues.length} large file(s) detected`,
    description: isClean
      ? "No unusually large source files detected."
      : `Found large files (>500KB): ${issues.slice(0, 3).join(", ")}${issues.length > 3 ? ` and ${issues.length - 3} more` : ""}.`,
    recommendation: isClean
      ? null
      : "Consider breaking up large files or adding them to .gitignore if they are generated artifacts.",
    fix_available: false,
    details: { large_files: issues.slice(0, 10) },
  };
}

// ── Run all deterministic checks ───────────────────────

export function runDeterministicChecks(repoRoot: string): CheckResult[] {
  return [
    checkClaudeMdExists(repoRoot),
    checkSkillsDefined(repoRoot),
    checkHooksConfigured(repoRoot),
    checkClaudeSettings(repoRoot),
    checkTestPaths(repoRoot),
    checkLocalDocs(repoRoot),
    checkRepoStructure(repoRoot),
  ];
}

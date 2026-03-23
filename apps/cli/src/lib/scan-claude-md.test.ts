import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { analyzeClaudeMd, checkClaudeMdQuality, generateClaudeMdContent } from "./scan-claude-md.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scan-claude-md-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("analyzeClaudeMd", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("returns all zeros when no CLAUDE.md exists", () => {
    const scores = analyzeClaudeMd(tmpDir);
    expect(scores.total).toBe(0);
    expect(scores.length).toBe(0);
    expect(scores.freshness).toBe(0);
    expect(scores.structure).toBe(0);
    expect(scores.specificity).toBe(0);
    expect(scores.completeness).toBe(0);
  });

  describe("scoreLength", () => {
    it("scores 5 for fewer than 10 lines", () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Title\nSome text\n");
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.length).toBe(5);
    });

    it("scores 10 for 10-50 lines", () => {
      const lines = Array.from({ length: 25 }, (_, i) => `Line ${i}`).join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), lines);
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.length).toBe(10);
    });

    it("scores 15 for 50-150 lines", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), lines);
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.length).toBe(15);
    });

    it("scores 20 for 150-500 lines", () => {
      const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}`).join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), lines);
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.length).toBe(20);
    });

    it("includes lines from .claude/rules/ files", () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Title\n");
      fs.mkdirSync(path.join(tmpDir, ".claude", "rules"), { recursive: true });
      const lines = Array.from({ length: 60 }, (_, i) => `Rule ${i}`).join("\n");
      fs.writeFileSync(path.join(tmpDir, ".claude", "rules", "coding.md"), lines);
      const scores = analyzeClaudeMd(tmpDir);
      // 2 lines from CLAUDE.md + 60 from rules = 62 → score 15
      expect(scores.length).toBe(15);
    });
  });

  describe("scoreStructure", () => {
    it("scores headings, lists, and code blocks", () => {
      const content = [
        "# Project Overview",
        "## Architecture",
        "- Item one",
        "- Item two",
        "- Item three",
        "- Item four",
        "```bash",
        "pnpm test",
        "```",
        "Use `pnpm lint` for linting.",
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), content);
      const scores = analyzeClaudeMd(tmpDir);
      // 2 headings × 2 = 4 (capped at 6), 4 list items / 2 = 2, 1 code block + inline = 2
      expect(scores.structure).toBeGreaterThanOrEqual(6);
    });

    it("awards points for .claude/rules/ files", () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Title\n");
      fs.mkdirSync(path.join(tmpDir, ".claude", "rules"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".claude", "rules", "a.md"), "Rule A");
      fs.writeFileSync(path.join(tmpDir, ".claude", "rules", "b.md"), "Rule B");
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.structure).toBeGreaterThanOrEqual(2);
    });
  });

  describe("scoreSpecificity", () => {
    it("scores high for content with file paths and commands", () => {
      const content = [
        "# Commands",
        "- Run `pnpm test` before committing",
        "- Run `pnpm lint` to check style",
        "- Check src/auth/ for authentication logic",
        "- The packages/web/ directory has the Next.js app",
        "- Use the AuthService for login flows",
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), content);
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.specificity).toBeGreaterThanOrEqual(15);
    });

    it("scores low for generic content", () => {
      const content = [
        "# Project",
        "This is a good project.",
        "We write clean code here.",
        "Always be careful.",
        "Think before you act.",
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), content);
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.specificity).toBeLessThanOrEqual(5);
    });
  });

  describe("scoreCompleteness", () => {
    it("scores 20 for fully complete content", () => {
      const content = [
        "# Commands",
        "- Run `pnpm test` to run tests",
        "- Run `pnpm build` to build",
        "# Architecture",
        "The src/ directory contains the main code",
        "# Conventions",
        "Follow naming conventions and eslint rules",
        "# Area Rules",
        "When modifying src/auth/, use the factory pattern",
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), content);
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.completeness).toBe(20);
    });

    it("scores 0 for content missing all areas", () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Hello\nJust a greeting.\n");
      const scores = analyzeClaudeMd(tmpDir);
      expect(scores.completeness).toBe(0);
    });
  });
});

describe("checkClaudeMdQuality", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("returns fail status when no CLAUDE.md exists", () => {
    const result = checkClaudeMdQuality(tmpDir, 10);
    expect(result.check_id).toBe("claude_md_quality");
    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
    expect(result.weight).toBe(10);
  });

  it("normalizes sub-dimension total to check weight", () => {
    // Create a CLAUDE.md that should score ~50/100 in sub-dimensions
    const content = Array.from({ length: 60 }, (_, i) => `Line ${i}: use src/lib/ patterns`).join("\n");
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), content);
    const result = checkClaudeMdQuality(tmpDir, 10);
    // Score should be normalized: (total/100) * 10
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.details).toHaveProperty("sub_scores");
  });
});

describe("generateClaudeMdContent", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("generates placeholder content for empty repo", () => {
    const content = generateClaudeMdContent(tmpDir);
    expect(content).toContain("# Project Overview");
    expect(content).toContain("# Key Commands");
    expect(content).toContain("# Coding Conventions");
  });

  it("picks up scripts from package.json", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { test: "vitest", lint: "eslint .", build: "tsc" } })
    );
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    const content = generateClaudeMdContent(tmpDir);
    expect(content).toContain("pnpm test");
    expect(content).toContain("pnpm lint");
    expect(content).toContain("pnpm build");
  });

  it("detects key directories", () => {
    fs.mkdirSync(path.join(tmpDir, "src"));
    fs.mkdirSync(path.join(tmpDir, "docs"));
    const content = generateClaudeMdContent(tmpDir);
    expect(content).toContain("`src/`");
    expect(content).toContain("`docs/`");
  });
});

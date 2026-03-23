import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { extractDirectives, checkClaudeMdCompliance } from "./scan-directives.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scan-directives-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("extractDirectives", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("returns empty array when no CLAUDE.md exists", () => {
    const directives = extractDirectives(tmpDir);
    expect(directives).toEqual([]);
  });

  it("extracts bullet-point directives with actionable verbs", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      [
        "# Rules",
        "- Run `pnpm test` before committing",
        "- Always use TypeScript strict mode",
        "- Ensure src/auth/ directory structure follows module layout",
      ].join("\n")
    );
    const directives = extractDirectives(tmpDir);
    expect(directives).toHaveLength(3);
    expect(directives[0].directive).toContain("pnpm test");
    expect(directives[0].category).toBe("testing");
    expect(directives[1].category).toBe("conventions");
    expect(directives[2].category).toBe("architecture");
  });

  it("extracts imperative sentences outside lists", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      "# Guide\nAlways run lint before pushing.\nNever commit directly to main.\n"
    );
    const directives = extractDirectives(tmpDir);
    expect(directives).toHaveLength(2);
    expect(directives[0].directive).toContain("lint");
    expect(directives[1].directive).toContain("commit");
  });

  it("skips content inside code blocks", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      [
        "# Rules",
        "- Run `pnpm test` before committing",
        "```bash",
        "- Use this command to deploy",
        "Always run this first",
        "```",
        "- Always check types",
      ].join("\n")
    );
    const directives = extractDirectives(tmpDir);
    expect(directives).toHaveLength(2);
    expect(directives[0].directive).toContain("pnpm test");
    expect(directives[1].directive).toContain("check types");
  });

  it("skips lines that are too short", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      "# Rules\n- Use it\n- Always run `pnpm test` before pushing\n"
    );
    const directives = extractDirectives(tmpDir);
    // "Use it" is < 10 chars, should be skipped
    expect(directives).toHaveLength(1);
  });

  it("records correct source_file and source_line", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      "# Title\n\n- Run `pnpm test` before committing\n"
    );
    const directives = extractDirectives(tmpDir);
    expect(directives[0].source_file).toBe("CLAUDE.md");
    expect(directives[0].source_line).toBe(3);
  });

  it("extracts directives from .claude/rules/ files", () => {
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# Project\n");
    fs.mkdirSync(path.join(tmpDir, ".claude", "rules"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "rules", "testing.md"),
      "- Always run `jest --coverage` after changes\n"
    );
    const directives = extractDirectives(tmpDir);
    expect(directives).toHaveLength(1);
    expect(directives[0].source_file).toBe(".claude/rules/testing.md");
    expect(directives[0].category).toBe("testing");
  });

  it("categorizes build/lint directives as tooling", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      "- Run `eslint .` to check formatting\n- Always build before deploying\n"
    );
    const directives = extractDirectives(tmpDir);
    expect(directives.every((d) => d.category === "tooling")).toBe(true);
  });
});

describe("checkClaudeMdCompliance", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("returns fail when no directives found", () => {
    const result = checkClaudeMdCompliance(tmpDir);
    expect(result.check_id).toBe("claude_md_compliance");
    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
  });

  it("returns pass with 4+ categories covered", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      [
        "- Run `pnpm test` before committing",
        "- Run `eslint .` for linting",
        "- Use factory pattern in src/auth/ directory structure",
        "- Always use snake_case naming convention for variables",
        "- Never commit directly to main branch",
      ].join("\n")
    );
    const result = checkClaudeMdCompliance(tmpDir);
    expect(result.status).toBe("pass");
    expect(result.score).toBe(10);
  });

  it("caps score when too few directives", () => {
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      "- Run `pnpm test` before committing\n"
    );
    const result = checkClaudeMdCompliance(tmpDir);
    // Only 1 directive → capped to 2
    expect(result.score).toBeLessThanOrEqual(2);
  });
});

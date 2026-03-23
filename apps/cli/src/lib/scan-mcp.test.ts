import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { detectRepoType, checkMcpServerAdoption } from "./scan-mcp.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scan-mcp-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("detectRepoType", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("returns 'general' for empty repo", () => {
    expect(detectRepoType(tmpDir)).toBe("general");
  });

  it("detects web_frontend from React dependency", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } })
    );
    expect(detectRepoType(tmpDir)).toBe("web_frontend");
  });

  it("detects api_backend from Express dependency", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" } })
    );
    expect(detectRepoType(tmpDir)).toBe("api_backend");
  });

  it("detects full_stack from React + Express", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        dependencies: { react: "^18.0.0", express: "^4.0.0" },
      })
    );
    expect(detectRepoType(tmpDir)).toBe("full_stack");
  });

  it("detects api_backend from Go module", () => {
    fs.writeFileSync(path.join(tmpDir, "go.mod"), "module example.com/api\n");
    expect(detectRepoType(tmpDir)).toBe("api_backend");
  });

  it("detects api_backend from Python FastAPI", () => {
    fs.writeFileSync(
      path.join(tmpDir, "pyproject.toml"),
      '[tool.poetry.dependencies]\nfastapi = "^0.100.0"\n'
    );
    expect(detectRepoType(tmpDir)).toBe("api_backend");
  });

  it("detects documentation from mkdocs.yml", () => {
    fs.writeFileSync(path.join(tmpDir, "mkdocs.yml"), "site_name: Docs\n");
    expect(detectRepoType(tmpDir)).toBe("documentation");
  });

  it("detects full_stack from monorepo with sub-packages", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({}));
    fs.mkdirSync(path.join(tmpDir, "packages", "web"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "packages", "api"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "packages", "web", "package.json"),
      JSON.stringify({ dependencies: { next: "^14.0.0" } })
    );
    fs.writeFileSync(
      path.join(tmpDir, "packages", "api", "package.json"),
      JSON.stringify({ dependencies: { fastify: "^4.0.0" } })
    );
    expect(detectRepoType(tmpDir)).toBe("full_stack");
  });
});

describe("checkMcpServerAdoption", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it("returns pass with partial score for general repos with no MCP config", () => {
    const result = checkMcpServerAdoption(tmpDir);
    expect(result.check_id).toBe("mcp_server_adoption");
    expect(result.status).toBe("pass");
    expect(result.score).toBe(7);
    expect(result.details).toHaveProperty("repo_type", "general");
  });

  it("returns fail for web project with no MCP servers", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } })
    );
    const result = checkMcpServerAdoption(tmpDir);
    expect(result.status).toBe("fail");
    expect(result.score).toBe(0);
  });

  it("scores 5 for web project with 1 recommended server", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } })
    );
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({ mcpServers: { playwright: { command: "npx", args: ["playwright"] } } })
    );
    const result = checkMcpServerAdoption(tmpDir);
    expect(result.score).toBe(5);
    expect(result.status).toBe("warn");
  });

  it("scores 10 for web project with all recommended servers", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } })
    );
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        mcpServers: {
          playwright: { command: "npx" },
          "chrome-devtools": { command: "npx" },
        },
      })
    );
    const result = checkMcpServerAdoption(tmpDir);
    expect(result.score).toBe(10);
    expect(result.status).toBe("pass");
  });

  it("scores 3 for web project with non-recommended MCP servers", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" } })
    );
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        mcpServers: { "some-other-server": { command: "npx" } },
      })
    );
    const result = checkMcpServerAdoption(tmpDir);
    expect(result.score).toBe(3);
  });

  it("reads from settings.local.json too", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" } })
    );
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "settings.local.json"),
      JSON.stringify({ mcpServers: { context7: { command: "npx" } } })
    );
    const result = checkMcpServerAdoption(tmpDir);
    expect(result.score).toBe(10);
    expect(result.status).toBe("pass");
  });

  it("uses pattern matching for server names", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.0.0" } })
    );
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        mcpServers: { "@anthropic/context7-mcp": { command: "npx" } },
      })
    );
    const result = checkMcpServerAdoption(tmpDir);
    // Should match "context7" via includes
    expect(result.score).toBe(10);
  });
});

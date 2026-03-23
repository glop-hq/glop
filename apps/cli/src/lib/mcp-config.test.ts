import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";
import os from "os";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

const { readFileSync } = await import("fs");
const { readMcpConfigs } = await import("./mcp-config.js");

beforeEach(() => {
  vi.mocked(readFileSync).mockReset();
});

function mockSettingsFile(filePath: string, mcpServers: Record<string, unknown>) {
  vi.mocked(readFileSync).mockImplementation((p: any) => {
    if (p === filePath) return JSON.stringify({ mcpServers });
    throw new Error("ENOENT");
  });
}

function mockBothFiles(
  globalMcps: Record<string, unknown>,
  projectMcps: Record<string, unknown>,
  repoRoot = "/repo"
) {
  const globalPath = path.join(os.homedir(), ".claude", "settings.json");
  const projectPath = path.join(repoRoot, ".claude", "settings.json");
  vi.mocked(readFileSync).mockImplementation((p: any) => {
    if (p === globalPath) return JSON.stringify({ mcpServers: globalMcps });
    if (p === projectPath) return JSON.stringify({ mcpServers: projectMcps });
    throw new Error("ENOENT");
  });
}

describe("readMcpConfigs", () => {
  it("returns empty array when no settings files exist", () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(readMcpConfigs()).toEqual([]);
  });

  it("returns empty array when settings has no mcpServers", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    mockSettingsFile(globalPath, {});
    // readFileSync for global returns {}, for project throws
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath) return JSON.stringify({});
      throw new Error("ENOENT");
    });
    expect(readMcpConfigs()).toEqual([]);
  });

  it("resolves http MCP by url", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            slack: { type: "http", url: "https://mcp.slack.com/mcp" },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result).toEqual([
      {
        server_name: "slack",
        canonical_id: "https://mcp.slack.com/mcp",
        transport: "http",
      },
    ]);
  });

  it("resolves sse MCP by url", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            linear: { type: "sse", url: "https://mcp.linear.app/sse" },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result).toEqual([
      {
        server_name: "linear",
        canonical_id: "https://mcp.linear.app/sse",
        transport: "sse",
      },
    ]);
  });

  it("infers http transport when type is missing but url is present", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            api: { url: "https://example.com/mcp" },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result).toHaveLength(1);
    expect(result[0].transport).toBe("http");
    expect(result[0].canonical_id).toBe("https://example.com/mcp");
  });

  it("resolves stdio MCP with npx and scoped package", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            filesystem: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result).toEqual([
      {
        server_name: "filesystem",
        canonical_id: "@modelcontextprotocol/server-filesystem",
        transport: "stdio",
      },
    ]);
  });

  it("resolves stdio MCP with bunx", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            github: {
              command: "bunx",
              args: ["@modelcontextprotocol/server-github"],
            },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result[0].canonical_id).toBe(
      "@modelcontextprotocol/server-github"
    );
  });

  it("falls back to command + first arg for non-npx stdio", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            custom: {
              command: "python",
              args: ["-m", "my_mcp_server"],
            },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    // Skips "-m" (flag), takes "my_mcp_server"
    expect(result[0].canonical_id).toBe("python my_mcp_server");
    expect(result[0].transport).toBe("stdio");
  });

  it("falls back to command alone when no args", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            bare: { command: "my-mcp-binary" },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result[0].canonical_id).toBe("my-mcp-binary");
  });

  it("project settings override global for same server name", () => {
    mockBothFiles(
      { slack: { type: "http", url: "https://old.slack.com/mcp" } },
      { slack: { type: "http", url: "https://new.slack.com/mcp" } }
    );
    const result = readMcpConfigs("/repo");
    expect(result).toHaveLength(1);
    expect(result[0].canonical_id).toBe("https://new.slack.com/mcp");
  });

  it("merges distinct MCPs from global and project", () => {
    mockBothFiles(
      { slack: { type: "http", url: "https://mcp.slack.com/mcp" } },
      { jira: { type: "http", url: "https://mcp.jira.com/mcp" } }
    );
    const result = readMcpConfigs("/repo");
    expect(result).toHaveLength(2);
    const names = result.map((r) => r.server_name).sort();
    expect(names).toEqual(["jira", "slack"]);
  });

  it("skips entries that cannot resolve a canonical id", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath)
        return JSON.stringify({
          mcpServers: {
            // http with no url
            broken: { type: "http" },
            // valid one
            good: { type: "http", url: "https://example.com" },
          },
        });
      throw new Error("ENOENT");
    });
    const result = readMcpConfigs();
    expect(result).toHaveLength(1);
    expect(result[0].server_name).toBe("good");
  });

  it("handles malformed JSON gracefully", () => {
    const globalPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(readFileSync).mockImplementation((p: any) => {
      if (p === globalPath) return "not json{{{";
      throw new Error("ENOENT");
    });
    expect(readMcpConfigs()).toEqual([]);
  });
});

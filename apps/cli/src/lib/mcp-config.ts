import { readFileSync } from "fs";
import path from "path";
import os from "os";

export interface McpEntry {
  server_name: string;
  canonical_id: string;
  transport: "http" | "sse" | "stdio";
}

interface McpServerConfig {
  type?: string;
  url?: string;
  command?: string;
  args?: string[];
  [key: string]: unknown;
}

/**
 * Extract the npm package name from stdio MCP args.
 * Looks for patterns like ["-y", "@scope/package", ...] or ["package-name", ...]
 */
function extractNpmPackage(args: string[]): string | null {
  for (const arg of args) {
    // Skip flags
    if (arg.startsWith("-")) continue;
    // Scoped package: @scope/name
    if (arg.startsWith("@") && arg.includes("/")) return arg;
    // Unscoped package name (letters, digits, dashes)
    if (/^[a-z][a-z0-9.-]*$/i.test(arg)) return arg;
  }
  return null;
}

function resolveCanonicalId(config: McpServerConfig): {
  canonical_id: string;
  transport: "http" | "sse" | "stdio";
} | null {
  const type = config.type ?? (config.url ? "http" : "stdio");

  if (type === "http" || type === "sse") {
    if (config.url) {
      return { canonical_id: config.url, transport: type as "http" | "sse" };
    }
    return null;
  }

  // stdio
  const command = config.command ?? "";
  const args = config.args ?? [];

  if (command === "npx" || command === "bunx" || command === "pnpx") {
    const pkg = extractNpmPackage(args);
    if (pkg) return { canonical_id: pkg, transport: "stdio" };
  }

  // Fallback: use command + first non-flag arg
  const firstArg = args.find((a) => !a.startsWith("-"));
  const fallback = firstArg ? `${command} ${firstArg}` : command;
  if (fallback) return { canonical_id: fallback, transport: "stdio" };

  return null;
}

function readSettingsFile(filePath: string): Record<string, McpServerConfig> {
  try {
    const content = readFileSync(filePath, "utf-8");
    const settings = JSON.parse(content);
    return (settings.mcpServers ?? {}) as Record<string, McpServerConfig>;
  } catch {
    return {};
  }
}

/**
 * Read MCP server configs from Claude Code settings files.
 * Reads global (~/.claude/settings.json) and project-level settings,
 * merges them (project overrides global), and resolves canonical identities.
 */
export function readMcpConfigs(repoRoot?: string): McpEntry[] {
  const globalPath = path.join(os.homedir(), ".claude", "settings.json");
  const globalMcps = readSettingsFile(globalPath);

  let projectMcps: Record<string, McpServerConfig> = {};
  if (repoRoot) {
    const projectPath = path.join(repoRoot, ".claude", "settings.json");
    projectMcps = readSettingsFile(projectPath);
  }

  // Merge: project overrides global for same key
  const merged = { ...globalMcps, ...projectMcps };

  const entries: McpEntry[] = [];
  for (const [serverName, config] of Object.entries(merged)) {
    const resolved = resolveCanonicalId(config);
    if (resolved) {
      entries.push({
        server_name: serverName,
        canonical_id: resolved.canonical_id,
        transport: resolved.transport,
      });
    }
  }

  return entries;
}

import fs from "fs";
import path from "path";
import type { CheckResult } from "./scan-checks.js";

// ── Repo type detection ─────────────────────────────────

export type RepoType = "web_frontend" | "api_backend" | "full_stack" | "documentation" | "general";

interface McpRecommendation {
  server: string;
  reason: string;
}

const REPO_TYPE_RECOMMENDATIONS: Record<RepoType, McpRecommendation[]> = {
  web_frontend: [
    { server: "playwright", reason: "Browser testing automation for web projects" },
    { server: "chrome-devtools", reason: "Chrome DevTools integration for debugging" },
  ],
  api_backend: [
    { server: "context7", reason: "API documentation context for backend development" },
  ],
  full_stack: [
    { server: "playwright", reason: "Browser testing automation for web projects" },
    { server: "context7", reason: "API documentation context for backend development" },
    { server: "chrome-devtools", reason: "Chrome DevTools integration for debugging" },
  ],
  documentation: [
    { server: "deepwiki", reason: "Documentation enhancement and knowledge management" },
  ],
  general: [],
};

// Optional bonus servers for any repo type
const BONUS_SERVERS = ["excalidraw"];

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function detectRepoType(repoRoot: string): RepoType {
  const pkgJsonContent = readFileSafe(path.join(repoRoot, "package.json"));
  let hasFrontend = false;
  let hasBackend = false;

  if (pkgJsonContent) {
    try {
      const pkg = JSON.parse(pkgJsonContent);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      // Frontend indicators
      const frontendPackages = ["react", "vue", "svelte", "angular", "next", "nuxt", "gatsby", "astro", "@angular/core", "solid-js", "preact"];
      hasFrontend = frontendPackages.some((p) => p in allDeps);

      // Backend indicators
      const backendPackages = ["express", "fastify", "koa", "hapi", "nestjs", "@nestjs/core", "hono", "drizzle-orm", "prisma", "typeorm", "sequelize"];
      hasBackend = backendPackages.some((p) => p in allDeps);
    } catch { /* ignore */ }
  }

  // Check for Python backend frameworks
  const pyProject = readFileSafe(path.join(repoRoot, "pyproject.toml"));
  if (pyProject) {
    if (/(?:fastapi|flask|django|starlette|tornado|aiohttp)/.test(pyProject)) {
      hasBackend = true;
    }
  }

  // Check for Go backend
  const goMod = readFileSafe(path.join(repoRoot, "go.mod"));
  if (goMod) {
    hasBackend = true;
  }

  // Check for documentation-heavy repos
  const hasDocsDir = fs.existsSync(path.join(repoRoot, "docs"));
  const hasMkdocs = fs.existsSync(path.join(repoRoot, "mkdocs.yml"));
  const hasDocusaurus = pkgJsonContent && pkgJsonContent.includes("docusaurus");
  if ((hasMkdocs || hasDocusaurus) && !hasFrontend && !hasBackend) {
    return "documentation";
  }

  if (hasFrontend && hasBackend) return "full_stack";
  if (hasFrontend) return "web_frontend";
  if (hasBackend) return "api_backend";

  // Check for monorepo with sub-packages
  if (fs.existsSync(path.join(repoRoot, "packages")) || fs.existsSync(path.join(repoRoot, "apps"))) {
    // Scan sub-packages for frontend/backend indicators
    for (const dir of ["packages", "apps"]) {
      const dirPath = path.join(repoRoot, dir);
      try {
        if (!fs.statSync(dirPath).isDirectory()) continue;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const subPkg = readFileSafe(path.join(dirPath, entry.name, "package.json"));
          if (!subPkg) continue;
          try {
            const pkg = JSON.parse(subPkg);
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            if (["react", "vue", "svelte", "next", "nuxt", "angular"].some((p) => p in deps)) hasFrontend = true;
            if (["express", "fastify", "hono", "drizzle-orm", "prisma"].some((p) => p in deps)) hasBackend = true;
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    if (hasFrontend && hasBackend) return "full_stack";
    if (hasFrontend) return "web_frontend";
    if (hasBackend) return "api_backend";
  }

  if (hasDocsDir && !hasFrontend && !hasBackend) return "documentation";

  return "general";
}

// ── MCP server detection ────────────────────────────────

interface McpConfig {
  configured: string[];
  source: string;
}

function readMcpConfig(repoRoot: string): McpConfig {
  const configured: string[] = [];
  const sources: string[] = [];

  for (const file of ["settings.json", "settings.local.json"]) {
    const content = readFileSafe(path.join(repoRoot, ".claude", file));
    if (!content) continue;
    try {
      const settings = JSON.parse(content);
      if (settings.mcpServers && typeof settings.mcpServers === "object") {
        const servers = Object.keys(settings.mcpServers);
        for (const s of servers) {
          if (!configured.includes(s)) {
            configured.push(s);
            sources.push(file);
          }
        }
      }
    } catch { /* ignore */ }
  }

  return { configured, source: sources.join(", ") || "none" };
}

// ── Check: MCP server adoption ──────────────────────────

export function checkMcpServerAdoption(repoRoot: string): CheckResult {
  const repoType = detectRepoType(repoRoot);
  const mcpConfig = readMcpConfig(repoRoot);
  const recommendations = REPO_TYPE_RECOMMENDATIONS[repoType];

  // No recommendations for this repo type
  if (recommendations.length === 0) {
    const hasAny = mcpConfig.configured.length > 0;
    return {
      check_id: "mcp_server_adoption",
      status: "pass",
      severity: "info",
      weight: 10,
      score: hasAny ? 10 : 7, // Partial credit even without recommendations
      title: hasAny
        ? `${mcpConfig.configured.length} MCP server(s) configured`
        : "No specific MCP servers recommended",
      description: hasAny
        ? `MCP servers configured: ${mcpConfig.configured.join(", ")}. No specific recommendations for this repo type (${repoType}).`
        : `No specific MCP server recommendations for this repo type (${repoType}). Consider adding MCP servers for enhanced productivity.`,
      recommendation: null,
      fix_available: false,
      details: {
        repo_type: repoType,
        configured_servers: mcpConfig.configured,
        recommended_servers: [],
        bonus_servers: BONUS_SERVERS,
      },
    };
  }

  // Score based on recommended server coverage
  const recommendedNames = recommendations.map((r) => r.server);
  const configuredLower = mcpConfig.configured.map((s) => s.toLowerCase());

  const matchedRecommended = recommendedNames.filter((name) =>
    configuredLower.some((c) => c.includes(name))
  );

  const matchedBonus = BONUS_SERVERS.filter((name) =>
    configuredLower.some((c) => c.includes(name))
  );

  let score: number;
  if (mcpConfig.configured.length === 0) {
    score = 0;
  } else if (matchedRecommended.length === 0) {
    score = 3; // Has MCP config but no type-appropriate servers
  } else if (matchedRecommended.length === recommendedNames.length) {
    score = 10; // All recommended servers configured
  } else if (matchedRecommended.length >= 2) {
    score = 8; // 2+ recommended servers
  } else {
    score = 5; // 1 recommended server
  }

  // Bonus points (don't exceed weight)
  if (matchedBonus.length > 0 && score < 10) {
    score = Math.min(10, score + 1);
  }

  const pct = score / 10;
  const status: CheckResult["status"] =
    pct >= 0.7 ? "pass" : pct >= 0.4 ? "warn" : "fail";

  const missingRecommended = recommendedNames.filter(
    (name) => !configuredLower.some((c) => c.includes(name))
  );
  const missingDetails = recommendations.filter((r) =>
    missingRecommended.includes(r.server)
  );

  const description = status === "pass"
    ? `MCP servers well configured for ${repoType} repo. Configured: ${mcpConfig.configured.join(", ")}.`
    : `MCP server adoption for ${repoType} repo: ${matchedRecommended.length}/${recommendedNames.length} recommended servers configured.`;

  const recommendation = missingDetails.length > 0
    ? `Add recommended MCP servers: ${missingDetails.map((r) => `${r.server} (${r.reason})`).join(", ")}.`
    : null;

  return {
    check_id: "mcp_server_adoption",
    status,
    severity: "info",
    weight: 10,
    score,
    title: status === "pass"
      ? "MCP servers configured"
      : `MCP servers — ${missingRecommended.length} recommended server(s) missing`,
    description,
    recommendation,
    fix_available: false,
    details: {
      repo_type: repoType,
      configured_servers: mcpConfig.configured,
      recommended_servers: recommendedNames,
      matched_recommended: matchedRecommended,
      missing_recommended: missingRecommended,
      bonus_servers: matchedBonus,
    },
  };
}

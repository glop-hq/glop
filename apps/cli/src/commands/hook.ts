import { Command } from "commander";
import { openSync, readSync, closeSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";
import { loadConfig, loadRepoConfig } from "../lib/config.js";
import { getRepoRoot, getRepoKey, getBranch, getGitUserName, getGitUserEmail, getCommitDiffStats } from "../lib/git.js";
import { readMcpConfigs } from "../lib/mcp-config.js";

const PR_URL_RE = /(https:\/\/github\.com\/[^\s]+\/pull\/\d+)/;

/** Extract combined output from a Bash tool_response ({stdout, stderr} object). */
function extractBashOutput(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.stdout === "string") parts.push(r.stdout);
  if (typeof r.stderr === "string") parts.push(r.stderr);
  return parts.join("\n");
}

function extractSlugFromTranscript(transcriptPath: string): string | null {
  try {
    const fd = openSync(transcriptPath, "r");
    const buf = Buffer.alloc(262144); // 256KB
    const bytesRead = readSync(fd, buf, 0, 262144, 0);
    closeSync(fd);
    const head = buf.toString("utf-8", 0, bytesRead);
    const match = head.match(/"slug":"([^"]+)"/);
    if (match) return match[1];
    if (bytesRead < 262144) return null; // already read the whole file
    // Fallback: read entire file for edge cases (>256KB before slug)
    const full = readFileSync(transcriptPath, "utf-8");
    return full.match(/"slug":"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export const hookCommand = new Command("__hook")
  .description("internal")
  .action(async () => {
    const config = loadConfig();
    if (!config) return;

    // Require repo binding — exit silently if repo not initialized
    const repoConfig = loadRepoConfig();
    if (!repoConfig) return;

    let input = "";
    for await (const chunk of process.stdin) {
      input += chunk;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(input);
    } catch {
      return;
    }

    // Enrich with git info and workspace binding
    payload.repo_key = getRepoKey() || payload.cwd || "unknown";
    payload.branch = getBranch();
    payload.machine_id = config.machine_id;
    payload.workspace_id = repoConfig.workspace_id;
    payload.git_user_name = getGitUserName();
    payload.git_user_email = getGitUserEmail();

    // Enrich commits with diff stats
    const toolOutput = payload.hook_event_name === "PostToolUse" && payload.tool_name === "Bash"
      ? extractBashOutput(payload.tool_response)
      : "";
    if (
      toolOutput &&
      /\bgit\s+commit\b/.test(
        typeof (payload.tool_input as Record<string, unknown>)?.command === "string"
          ? (payload.tool_input as Record<string, unknown>).command as string
          : ""
      ) &&
      /\[\w[^\]]*\s+[a-f0-9]{7,}\]/.test(toolOutput)
    ) {
      const diffStats = getCommitDiffStats();
      if (diffStats) {
        payload.commit_diff_stats = diffStats;
      }
    }

    // Extract conversation slug from transcript file (skip high-frequency PostToolUse)
    const skipSlugEvents = new Set(["PostToolUse"]);
    if (!skipSlugEvents.has(payload.hook_event_name as string) && typeof payload.transcript_path === "string") {
      const slug = extractSlugFromTranscript(payload.transcript_path);
      if (slug) payload.slug = slug;
    }

    // Detect PR creation for background comment generation
    let prUrl: string | null = null;
    if (
      toolOutput &&
      /\bgh\s+pr\s+create\b/.test(
        typeof (payload.tool_input as Record<string, unknown>)?.command === "string"
          ? (payload.tool_input as Record<string, unknown>).command as string
          : ""
      )
    ) {
      const prMatch = toolOutput.match(PR_URL_RE);
      if (prMatch) prUrl = prMatch[1];
    }

    try {
      const res = await fetch(`${config.server_url}/api/v1/ingest/hook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      // Parse response body once
      const resBody = res.ok
        ? await res.json().catch(() => ({})) as { run_id?: string }
        : null;

      // On SessionStart, print connection status and run URL
      if (payload.hook_event_name === "SessionStart") {
        if (res.ok && resBody) {
          const runUrl = resBody.run_id
            ? `${config.server_url}/runs/${resBody.run_id}`
            : null;
          console.log(`glop: connected to ${config.server_url}`);
          if (runUrl) {
            console.log(`glop: Add "Glop-Run: ${runUrl}" as a git trailer in all commit messages and PR descriptions.`);
          }
        } else if (res.status === 401) {
          console.log("glop: API key expired or invalid — run `glop login` to re-authenticate");
        } else {
          console.log(`glop: server returned HTTP ${res.status}`);
        }
      }

      // Spawn background scan worker on SessionStart if scan is stale (>24h)
      if (payload.hook_event_name === "SessionStart" && res.ok) {
        try {
          const repoKey = payload.repo_key as string;
          const scanStatusRes = await fetch(
            `${config.server_url}/api/v1/repos/scan-status?workspace_id=${repoConfig.workspace_id}&repo_key=${encodeURIComponent(repoKey)}`,
            {
              headers: { Authorization: `Bearer ${config.api_key}` },
              signal: AbortSignal.timeout(3000),
            }
          );
          if (scanStatusRes.ok) {
            const scanStatus = (await scanStatusRes.json()) as { needs_scan: boolean };
            if (scanStatus.needs_scan) {
              const repoRoot = getRepoRoot();
              if (repoRoot) {
                const scanWorkerPath = path.join(
                  path.dirname(fileURLToPath(import.meta.url)),
                  "lib",
                  "scan-worker.js"
                );
                const child = spawn(
                  process.execPath,
                  [scanWorkerPath, config.server_url, repoConfig.workspace_id, repoRoot, repoKey],
                  { detached: true, stdio: "ignore", env: { ...process.env, GLOP_API_KEY: config.api_key } }
                );
                child.unref();
              }
            }
          }
        } catch {
          // Silently ignore — scan is best-effort
        }
      }

      // Show context health hint on SessionStart (once per day per repo)
      if (payload.hook_event_name === "SessionStart" && res.ok) {
        try {
          const repoKey = payload.repo_key as string;
          const hintFile = path.join(os.homedir(), ".config", "glop", "hint-timestamps.json");
          let hints: Record<string, string> = {};
          if (existsSync(hintFile)) {
            try { hints = JSON.parse(readFileSync(hintFile, "utf-8")); } catch { /* ignore */ }
          }
          const lastHint = hints[repoKey];
          const oneDayAgo = Date.now() - 86_400_000;
          if (!lastHint || new Date(lastHint).getTime() < oneDayAgo) {
            const recRes = await fetch(
              `${config.server_url}/api/v1/repos/context-recommendation?workspace_id=${repoConfig.workspace_id}&repo_key=${encodeURIComponent(repoKey)}`,
              {
                headers: { Authorization: `Bearer ${config.api_key}` },
                signal: AbortSignal.timeout(3000),
              }
            );
            if (recRes.ok) {
              const recBody = (await recRes.json()) as { data: { recommended_max_duration_min: number | null } | null };
              if (recBody.data?.recommended_max_duration_min) {
                console.log(`glop: Sessions in this repo work best under ${recBody.data.recommended_max_duration_min} minutes. Consider /compact or starting fresh after that.`);
                hints[repoKey] = new Date().toISOString();
                const dir = path.dirname(hintFile);
                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                writeFileSync(hintFile, JSON.stringify(hints, null, 2));
              }
            }
          }
        } catch {
          // Silently ignore — hint is best-effort
        }
      }

      // Sync MCP configs on SessionStart (best-effort)
      if (payload.hook_event_name === "SessionStart" && res.ok) {
        try {
          const repoRoot = getRepoRoot();
          const mcps = readMcpConfigs(repoRoot ?? undefined);
          if (mcps.length > 0) {
            await fetch(`${config.server_url}/api/v1/mcps/sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.api_key}`,
              },
              body: JSON.stringify({
                workspace_id: repoConfig.workspace_id,
                repo_key: payload.repo_key,
                mcps,
              }),
              signal: AbortSignal.timeout(3000),
            });
          }
        } catch {
          // Silently ignore — MCP sync is best-effort
        }
      }

      // Spawn background worker to generate and post PR comment
      if (prUrl && resBody?.run_id) {
        try {
          const workerPath = path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "lib",
            "pr-comment-worker.js"
          );
          const child = spawn(
            process.execPath,
            [workerPath, config.server_url, resBody.run_id, prUrl],
            { detached: true, stdio: "ignore", env: { ...process.env, GLOP_API_KEY: config.api_key } }
          );
          child.unref();
        } catch {
          // Silently ignore — PR comment is best-effort
        }
      }
      // Spawn background facet worker on SessionEnd
      if (payload.hook_event_name === "SessionEnd" && res.ok && resBody?.run_id) {
        try {
          const transcriptPath = payload.transcript_path;
          if (typeof transcriptPath === "string") {
            const repoRoot = getRepoRoot();
            if (repoRoot) {
              const facetWorkerPath = path.join(
                path.dirname(fileURLToPath(import.meta.url)),
                "lib",
                "facet-worker.js"
              );
              const repoKey = payload.repo_key as string;
              const child = spawn(
                process.execPath,
                [facetWorkerPath, config.server_url, repoConfig.workspace_id, repoRoot, repoKey, resBody.run_id, transcriptPath],
                {
                  detached: true,
                  stdio: "ignore",
                  env: {
                    ...process.env,
                    GLOP_API_KEY: config.api_key,
                    GLOP_DEVELOPER_ID: config.developer_id,
                  },
                }
              );
              child.unref();
            }
          }
        } catch {
          // Silently ignore — facet extraction is best-effort
        }
      }
    } catch {
      if (payload.hook_event_name === "SessionStart") {
        console.log(`glop: server unreachable at ${config.server_url}`);
      }
    }
  });

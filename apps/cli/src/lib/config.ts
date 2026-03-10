import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { getRepoRoot } from "./git.js";

const CONFIG_DIR = path.join(os.homedir(), ".glop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/** Flat config shape returned by loadConfig() — all callers use this unchanged */
export interface GlopConfig {
  server_url: string;
  api_key: string;
  developer_id: string;
  developer_name: string;
  machine_id: string;
  workspace_id?: string;
  workspace_name?: string;
  workspace_slug?: string;
}

export interface WorkspaceCredentials {
  api_key: string;
  developer_id: string;
  workspace_name?: string;
  workspace_slug?: string;
}

export interface GlopGlobalConfig {
  server_url: string;
  machine_id: string;
  developer_name: string;
  default_workspace?: string;
  workspaces: Record<string, WorkspaceCredentials>;
}

export interface RepoConfig {
  workspace_id: string;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getMachineId(): string {
  const machineIdFile = path.join(CONFIG_DIR, "machine_id");
  ensureConfigDir();

  if (fs.existsSync(machineIdFile)) {
    return fs.readFileSync(machineIdFile, "utf-8").trim();
  }

  const machineId = crypto.randomUUID();
  fs.writeFileSync(machineIdFile, machineId);
  return machineId;
}

export function loadGlobalConfig(): GlopGlobalConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as GlopGlobalConfig;
  } catch {
    return null;
  }
}

export function saveGlobalConfig(config: GlopGlobalConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadRepoConfig(): RepoConfig | null {
  const repoRoot = getRepoRoot();
  if (!repoRoot) return null;
  const repoConfigFile = path.join(repoRoot, ".glop", "config.json");
  if (!fs.existsSync(repoConfigFile)) return null;
  try {
    const raw = fs.readFileSync(repoConfigFile, "utf-8");
    return JSON.parse(raw) as RepoConfig;
  } catch {
    return null;
  }
}

export function saveRepoConfig(config: RepoConfig): void {
  const repoRoot = getRepoRoot();
  if (!repoRoot) throw new Error("Not in a git repository");
  const repoConfigDir = path.join(repoRoot, ".glop");
  if (!fs.existsSync(repoConfigDir)) {
    fs.mkdirSync(repoConfigDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(repoConfigDir, "config.json"),
    JSON.stringify(config, null, 2)
  );
}

/**
 * Resolves the active config by loading global config, then resolving
 * the workspace from: repo binding > default_workspace > first workspace.
 * Returns the same flat GlopConfig shape so all callers work unchanged.
 */
export function loadConfig(): GlopConfig | null {
  const global = loadGlobalConfig();
  if (!global || Object.keys(global.workspaces).length === 0) return null;

  const repoConfig = loadRepoConfig();
  const workspaceId =
    repoConfig?.workspace_id ||
    global.default_workspace ||
    Object.keys(global.workspaces)[0];

  if (!workspaceId) return null;

  const ws = global.workspaces[workspaceId];
  if (!ws) return null;

  return {
    server_url: global.server_url,
    api_key: ws.api_key,
    developer_id: ws.developer_id,
    developer_name: global.developer_name,
    machine_id: global.machine_id,
    workspace_id: workspaceId,
    workspace_name: ws.workspace_name,
    workspace_slug: ws.workspace_slug,
  };
}

declare const __DEFAULT_SERVER_URL__: string;

export function getDefaultServerUrl(): string {
  return process.env.GLOP_SERVER_URL || __DEFAULT_SERVER_URL__;
}

export function getServerUrl(): string {
  return loadConfig()?.server_url || getDefaultServerUrl();
}

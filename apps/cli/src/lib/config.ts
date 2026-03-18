import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { getRepoRoot } from "./git.js";

const CONFIG_DIR = path.join(os.homedir(), ".glop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/** Flat developer-level config — on-disk shape and runtime shape are identical */
export interface GlopConfig {
  server_url: string;
  machine_id: string;
  api_key: string;
  developer_id: string;
  developer_name: string;
}

/** @deprecated Use GlopConfig directly */
export type GlopGlobalConfig = GlopConfig;

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
 * Loads the flat global config. Returns null if not authenticated.
 */
export function loadConfig(): GlopConfig | null {
  const global = loadGlobalConfig();
  if (!global || !global.api_key) return null;

  return {
    server_url: global.server_url,
    api_key: global.api_key,
    developer_id: global.developer_id,
    developer_name: global.developer_name,
    machine_id: global.machine_id,
  };
}

declare const __DEFAULT_SERVER_URL__: string;

export function getDefaultServerUrl(): string {
  return process.env.GLOP_SERVER_URL || __DEFAULT_SERVER_URL__;
}

export function getServerUrl(): string {
  return loadConfig()?.server_url || getDefaultServerUrl();
}

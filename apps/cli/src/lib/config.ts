import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const CONFIG_DIR = path.join(os.homedir(), ".glop");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export interface GlopConfig {
  server_url: string;
  api_key: string;
  developer_id: string;
  developer_name: string;
  machine_id: string;
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

export function loadConfig(): GlopConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as GlopConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: GlopConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

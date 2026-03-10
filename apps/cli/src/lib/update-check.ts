import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".glop");
const CACHE_FILE = path.join(CONFIG_DIR, "update-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  last_check: number;
  latest_version: string;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function isNewerVersion(current: string, latest: string): boolean {
  const currentParts = current.split(".").map(Number);
  const latestParts = latest.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export async function checkForUpdate(currentVersion: string): Promise<void> {
  try {
    if (process.env.CI) return;
    if (!process.stderr.isTTY) return;

    let latestVersion: string | null = null;

    // Try reading cache
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const raw = fs.readFileSync(CACHE_FILE, "utf-8");
        const cache: UpdateCache = JSON.parse(raw);
        if (Date.now() - cache.last_check < CHECK_INTERVAL_MS) {
          latestVersion = cache.latest_version;
        }
      } catch {
        // Corrupt cache, will refetch
      }
    }

    // Fetch from npm if no valid cache
    if (!latestVersion) {
      const response = await fetch(
        "https://registry.npmjs.org/glop.dev/latest",
        { signal: AbortSignal.timeout(3000) }
      );
      const data = (await response.json()) as { version: string };
      latestVersion = data.version;

      // Write cache
      ensureConfigDir();
      const cache: UpdateCache = {
        last_check: Date.now(),
        latest_version: latestVersion,
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
    }

    if (isNewerVersion(currentVersion, latestVersion)) {
      console.error(
        `\n  Update available: ${currentVersion} → ${latestVersion}. Run \`npm i -g glop.dev\` to update.\n`
      );
    }
  } catch {
    // Silently ignore all errors
  }
}

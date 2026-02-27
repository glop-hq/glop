import { loadConfig } from "./config.js";

export function getConfig() {
  const config = loadConfig();
  if (!config) {
    console.error(
      "Not authenticated. Run `glop auth` first."
    );
    process.exit(1);
  }
  return config;
}

export async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const config = getConfig();
  const url = `${config.server_url}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.api_key}`,
    "X-Machine-Id": config.machine_id,
    ...(options.headers as Record<string, string>),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

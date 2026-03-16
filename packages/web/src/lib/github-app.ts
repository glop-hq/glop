import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<number, CachedToken>();

// 5-minute pre-expiry buffer
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function getAppConfig() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKeyBase64) return null;

  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf-8");
  return { appId, privateKey };
}

export function isGitHubAppConfigured(): boolean {
  return getAppConfig() !== null;
}

export async function getInstallationOctokit(
  installationId: number
): Promise<Octokit> {
  const config = getAppConfig();
  if (!config) {
    throw new Error("GitHub App is not configured");
  }

  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
    return new Octokit({ auth: cached.token });
  }

  const auth = createAppAuth({
    appId: config.appId,
    privateKey: config.privateKey,
  });

  const installationAuth = await auth({
    type: "installation",
    installationId,
  });

  tokenCache.set(installationId, {
    token: installationAuth.token,
    expiresAt:
      new Date(installationAuth.expiresAt).getTime() || Date.now() + 3600000,
  });

  return new Octokit({ auth: installationAuth.token });
}

export function getAppOctokit(): Octokit {
  const config = getAppConfig();
  if (!config) {
    throw new Error("GitHub App is not configured");
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: config.appId,
      privateKey: config.privateKey,
    },
  });
}

export function getWebhookSecret(): string {
  return process.env.GITHUB_APP_WEBHOOK_SECRET || "";
}

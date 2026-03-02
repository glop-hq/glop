import { createHash, randomBytes } from "crypto";
import { SHARE_TOKEN_BYTES } from "@glop/shared";

export function generateShareToken(): { token: string; hash: string } {
  const token = randomBytes(SHARE_TOKEN_BYTES).toString("hex");
  const hash = hashShareToken(token);
  return { token, hash };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildShareUrl(
  baseUrl: string,
  runId: string,
  token: string
): string {
  const url = new URL(`/shared/runs/${runId}`, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

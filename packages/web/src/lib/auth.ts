import { eq } from "drizzle-orm";
import { schema, type DbClient } from "./db";
import { createHash, randomBytes } from "crypto";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  return `glop_${randomBytes(24).toString("hex")}`;
}

export interface AuthInfo {
  developer_id: string;
  developer_name: string;
}

export async function validateApiKey(
  db: DbClient,
  key: string
): Promise<AuthInfo | null> {
  const hash = hashKey(key);
  const results = await db
    .select()
    .from(schema.api_keys)
    .where(eq(schema.api_keys.key_hash, hash))
    .limit(1);

  if (results.length === 0) return null;

  return {
    developer_id: results[0].developer_id,
    developer_name: results[0].developer_name,
  };
}

export async function registerDeveloper(
  db: DbClient,
  developerName: string
): Promise<{ api_key: string; developer_id: string }> {
  const apiKey = generateApiKey();
  const developerId = crypto.randomUUID();
  const hash = hashKey(apiKey);

  await db.insert(schema.api_keys).values({
    id: crypto.randomUUID(),
    key_hash: hash,
    developer_id: developerId,
    developer_name: developerName,
    created_at: new Date().toISOString(),
  });

  return { api_key: apiKey, developer_id: developerId };
}

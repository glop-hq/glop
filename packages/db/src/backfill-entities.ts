import { drizzle } from "drizzle-orm/node-postgres";
import { eq, isNull, sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/glop",
});

const db = drizzle(pool);

async function backfillRepos() {
  console.log("Backfilling repos...");

  // Get distinct (workspace_id, repo_key) from runs that have no repo_id
  const distinctRepos = await db
    .selectDistinct({
      workspace_id: schema.runs.workspace_id,
      repo_key: schema.runs.repo_key,
    })
    .from(schema.runs)
    .where(isNull(schema.runs.repo_id));

  console.log(`Found ${distinctRepos.length} distinct repos to backfill`);

  // Batch upsert repos
  const BATCH_SIZE = 500;
  for (let i = 0; i < distinctRepos.length; i += BATCH_SIZE) {
    const batch = distinctRepos.slice(i, i + BATCH_SIZE);
    const now = new Date().toISOString();

    for (const { workspace_id, repo_key } of batch) {
      const displayName = repo_key.includes("/")
        ? repo_key.split("/").pop()!
        : repo_key;

      await db
        .insert(schema.repos)
        .values({
          workspace_id,
          repo_key,
          display_name: displayName,
          first_seen_at: now,
          last_active_at: now,
        })
        .onConflictDoNothing({
          target: [schema.repos.workspace_id, schema.repos.repo_key],
        });
    }

    console.log(
      `  Upserted repos ${i + 1}-${Math.min(i + BATCH_SIZE, distinctRepos.length)}`
    );
  }

  // Bulk update runs to set repo_id via JOIN
  const updated = await db.execute(sql`
    UPDATE runs
    SET repo_id = repos.id
    FROM repos
    WHERE runs.workspace_id = repos.workspace_id
      AND runs.repo_key = repos.repo_key
      AND runs.repo_id IS NULL
  `);

  console.log(`Updated runs with repo_id`);
}

async function backfillDevelopers() {
  console.log("Backfilling developers...");

  // Get distinct developer identities from runs that have no developer_entity_id
  const distinctDevs = await db
    .selectDistinct({
      workspace_id: schema.runs.workspace_id,
      developer_id: schema.runs.developer_id,
      git_user_email: schema.runs.git_user_email,
      git_user_name: schema.runs.git_user_name,
    })
    .from(schema.runs)
    .where(isNull(schema.runs.developer_entity_id));

  console.log(`Found ${distinctDevs.length} distinct developer identities to backfill`);

  // Group by (workspace_id, email) where email exists, else by (workspace_id, developer_id)
  const grouped = new Map<
    string,
    {
      workspace_id: string;
      developer_ids: Set<string>;
      email: string | null;
      name: string | null;
    }
  >();

  for (const dev of distinctDevs) {
    const key = dev.git_user_email
      ? `${dev.workspace_id}:email:${dev.git_user_email}`
      : `${dev.workspace_id}:devid:${dev.developer_id}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.developer_ids.add(dev.developer_id);
      if (!existing.name && dev.git_user_name) {
        existing.name = dev.git_user_name;
      }
    } else {
      grouped.set(key, {
        workspace_id: dev.workspace_id,
        developer_ids: new Set([dev.developer_id]),
        email: dev.git_user_email,
        name: dev.git_user_name,
      });
    }
  }

  console.log(`Grouped into ${grouped.size} unique developers`);

  const now = new Date().toISOString();
  let count = 0;

  for (const group of grouped.values()) {
    const identityKeys = [...group.developer_ids];
    if (group.email) identityKeys.push(group.email);

    await db
      .insert(schema.developers)
      .values({
        workspace_id: group.workspace_id,
        display_name: group.name,
        email: group.email,
        identity_keys: [...new Set(identityKeys)],
        first_seen_at: now,
        last_active_at: now,
      })
      .onConflictDoNothing();

    count++;
    if (count % 500 === 0) {
      console.log(`  Upserted ${count} developers`);
    }
  }

  console.log(`Upserted ${count} total developers`);

  // Bulk update runs: match by email first
  await db.execute(sql`
    UPDATE runs
    SET developer_entity_id = developers.id
    FROM developers
    WHERE runs.workspace_id = developers.workspace_id
      AND runs.git_user_email IS NOT NULL
      AND runs.git_user_email = developers.email
      AND runs.developer_entity_id IS NULL
  `);

  // Bulk update runs: match by developer_id in identity_keys for remaining
  await db.execute(sql`
    UPDATE runs
    SET developer_entity_id = developers.id
    FROM developers
    WHERE runs.workspace_id = developers.workspace_id
      AND developers.identity_keys @> to_jsonb(runs.developer_id)
      AND runs.developer_entity_id IS NULL
  `);

  console.log(`Updated runs with developer_entity_id`);
}

async function main() {
  console.log("Starting entity backfill...");
  await backfillRepos();
  await backfillDevelopers();
  console.log("Backfill complete!");
  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  pool.end();
  process.exit(1);
});

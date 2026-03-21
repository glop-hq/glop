import { eq, and, sql } from "drizzle-orm";
import { schema, type DbClient } from "./db";

export interface DeveloperContext {
  developer_id: string;
  developer_name: string;
  git_user_email: string | null;
  git_user_name: string | null;
}

/**
 * Resolve or create a developer entity record.
 * Matches by (workspace_id, email) first, then by identity_keys containment.
 * Returns the developer entity UUID.
 */
export async function resolveOrCreateDeveloper(
  db: DbClient,
  workspaceId: string,
  ctx: DeveloperContext,
  now: string
): Promise<string> {
  // Build the set of identity keys for this session
  const identityKeys = new Set<string>();
  identityKeys.add(ctx.developer_id);
  if (ctx.git_user_email) identityKeys.add(ctx.git_user_email);

  // 1. Try to find by email (most reliable, uses unique index)
  if (ctx.git_user_email) {
    const [existing] = await db
      .select()
      .from(schema.developers)
      .where(
        and(
          eq(schema.developers.workspace_id, workspaceId),
          eq(schema.developers.email, ctx.git_user_email)
        )
      )
      .limit(1);

    if (existing) {
      // Merge any new identity keys and update last_active_at
      const existingKeys = new Set(existing.identity_keys);
      const newKeys = [...identityKeys].filter((k) => !existingKeys.has(k));
      const mergedKeys =
        newKeys.length > 0
          ? [...existing.identity_keys, ...newKeys]
          : undefined;

      await db
        .update(schema.developers)
        .set({
          last_active_at: now,
          updated_at: now,
          ...(mergedKeys ? { identity_keys: mergedKeys } : {}),
          // Update display_name if we have a better one
          ...(!existing.display_name && ctx.git_user_name
            ? { display_name: ctx.git_user_name }
            : {}),
        })
        .where(eq(schema.developers.id, existing.id));

      return existing.id;
    }
  }

  // 2. Try to find by identity_keys containment (developer_id text match)
  const [byKey] = await db
    .select()
    .from(schema.developers)
    .where(
      and(
        eq(schema.developers.workspace_id, workspaceId),
        sql`${schema.developers.identity_keys} @> ${JSON.stringify([ctx.developer_id])}::jsonb`
      )
    )
    .limit(1);

  if (byKey) {
    const existingKeys = new Set(byKey.identity_keys);
    const newKeys = [...identityKeys].filter((k) => !existingKeys.has(k));
    const mergedKeys =
      newKeys.length > 0 ? [...byKey.identity_keys, ...newKeys] : undefined;

    await db
      .update(schema.developers)
      .set({
        last_active_at: now,
        updated_at: now,
        ...(mergedKeys ? { identity_keys: mergedKeys } : {}),
        // Fill in email if we now have it and it wasn't set before
        ...(!byKey.email && ctx.git_user_email
          ? { email: ctx.git_user_email }
          : {}),
        ...(!byKey.display_name && ctx.git_user_name
          ? { display_name: ctx.git_user_name }
          : {}),
      })
      .where(eq(schema.developers.id, byKey.id));

    return byKey.id;
  }

  // 3. Create new developer record
  const [inserted] = await db
    .insert(schema.developers)
    .values({
      workspace_id: workspaceId,
      display_name: ctx.git_user_name || ctx.developer_name || null,
      email: ctx.git_user_email || null,
      identity_keys: [...identityKeys],
      first_seen_at: now,
      last_active_at: now,
    })
    .onConflictDoUpdate({
      target: [schema.developers.workspace_id, schema.developers.email],
      set: {
        last_active_at: now,
        updated_at: now,
      },
      setWhere: sql`email IS NOT NULL`,
    })
    .returning({ id: schema.developers.id });

  return inserted.id;
}

/**
 * Resolve or create a repo entity record.
 * Upserts on (workspace_id, repo_key).
 * Returns the repo entity UUID.
 */
export async function resolveOrCreateRepo(
  db: DbClient,
  workspaceId: string,
  repoKey: string,
  now: string
): Promise<string> {
  // Derive display name from repo_key (take the part after /)
  const displayName = repoKey.includes("/")
    ? repoKey.split("/").pop()!
    : repoKey;

  const [result] = await db
    .insert(schema.repos)
    .values({
      workspace_id: workspaceId,
      repo_key: repoKey,
      display_name: displayName,
      first_seen_at: now,
      last_active_at: now,
    })
    .onConflictDoUpdate({
      target: [schema.repos.workspace_id, schema.repos.repo_key],
      set: {
        last_active_at: now,
        updated_at: now,
      },
    })
    .returning({ id: schema.repos.id });

  return result.id;
}

# CLAUDE.md

## Database Migrations

Migrations are managed with Drizzle Kit from `packages/db/`.

1. Update `packages/db/src/schema.ts` with the new tables/columns.
2. Generate a migration file:
   ```
   cd packages/db && npx drizzle-kit generate
   ```
   This creates a new SQL file in `packages/db/drizzle/` based on the diff between the schema and the last snapshot.
3. Apply to production:
   ```
   cd packages/db && DATABASE_URL="<prod-url>" npx drizzle-kit migrate
   ```
   Migrations are tracked in the `__drizzle_migrations` table. Only unapplied migrations will run.

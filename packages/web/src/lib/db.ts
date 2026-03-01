import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@glop/db/schema";

export { schema };
export type DbClient = ReturnType<typeof drizzle>;

let db: DbClient | null = null;
let pool: pg.Pool | null = null;

export function getDb(): DbClient {
  if (!db) {
    pool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://localhost:5432/glop",
    });
    db = drizzle(pool, { schema });
  }
  return db;
}

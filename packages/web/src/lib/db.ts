import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@glop/db/schema";
import path from "path";

export { schema };
export type DbClient = ReturnType<typeof drizzle>;

let db: DbClient | null = null;

export function getDb(): DbClient {
  if (!db) {
    const dbPath =
      process.env.DATABASE_PATH ||
      path.resolve(process.cwd(), "..", "..", "glop.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    db = drizzle(sqlite, { schema });
  }
  return db;
}

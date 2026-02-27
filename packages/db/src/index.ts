import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export { schema };
export type DbClient = ReturnType<typeof drizzle>;

export function createDb(sqliteDb: unknown) {
  const db = drizzle(sqliteDb as never, { schema });
  return db;
}

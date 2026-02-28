import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import type { Pool } from "pg";

export { schema };
export type DbClient = ReturnType<typeof drizzle>;

export function createDb(pool: Pool) {
  return drizzle(pool, { schema });
}

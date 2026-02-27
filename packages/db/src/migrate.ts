import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./index.js";

const dbPath = process.env.DATABASE_PATH || "../../glop.db";
const db = createDb(dbPath);

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete");

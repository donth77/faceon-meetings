import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

let database: NodePgDatabase<typeof schema> | undefined;

/**
 * The app's database: Neon's pooled connection through node-postgres, which supports
 * transactions. Created on first use, so pages that never touch the database build
 * without DATABASE_URL.
 */
export function db(): NodePgDatabase<typeof schema> {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString, max: 5 });
  // On Vercel, lets idle connections close cleanly before a function instance is suspended.
  attachDatabasePool(pool);
  database = drizzle(pool, { schema });
  return database;
}

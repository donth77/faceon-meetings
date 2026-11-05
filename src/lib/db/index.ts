import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

let database: NodePgDatabase<typeof schema> | undefined;

type Database = NodePgDatabase<typeof schema>;
/** A transaction from db().transaction(), for helpers that run inside one. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** The database, or a transaction in progress: where a helper runs its queries. */
export type Executor = Database | Transaction;

/**
 * The app's database: Neon's pooled connection through node-postgres, which supports
 * transactions. Created on first use, so pages that never touch the database build
 * without DATABASE_URL.
 */
export function db(): NodePgDatabase<typeof schema> {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  // Neon's URLs say sslmode=require, which node-postgres already treats as verify-full
  // (and warns about); naming it verify-full keeps the same checks without the warning.
  const pool = new Pool({
    connectionString: connectionString.replace(
      "sslmode=require",
      "sslmode=verify-full",
    ),
    max: 5,
  });
  // On Vercel, lets idle connections close cleanly before a function instance is suspended.
  attachDatabasePool(pool);
  // An idle connection the database closed (Neon suspending, or restarting) is reported
  // on the pool once the pool has dropped it; with nothing listening, it would crash the
  // function. Nothing was using it, and the next query opens a new one.
  pool.on("error", () => {});
  database = drizzle(pool, { schema });
  return database;
}

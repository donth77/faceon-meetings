import "server-only";

import { serverEnv } from "@/lib/server-env";

import { shouldWakeDatabase } from "./wake-rule";

/**
 * Whether this copy's database sleeps when idle, so pages wake it as someone shows intent
 * (DATABASE_WAKE_ON_INTENT; wake-rule.ts).
 */
export function wakesDatabase(): boolean {
  return shouldWakeDatabase(
    serverEnv().DATABASE_WAKE_ON_INTENT,
    process.env.DATABASE_URL,
  );
}

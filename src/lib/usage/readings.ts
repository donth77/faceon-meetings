import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageReading } from "@/lib/db/schema";

/** How long a service's figures stay fresh: Settings → Admin asks at most this often. */
export const FRESH_MS = 5 * 60_000;

export type ServiceReading = { data: Record<string, unknown>; readAt: Date };

/** A service's latest reading ("resend", "neon"), or null before the first. */
export async function lastReading(
  source: string,
): Promise<ServiceReading | null> {
  const [row] = await db()
    .select({ data: usageReading.data, readAt: usageReading.readAt })
    .from(usageReading)
    .where(eq(usageReading.source, source));
  return row ?? null;
}

/** Whether a reading is recent enough not to ask the service again. */
export const isFresh = (reading: ServiceReading | null, now: Date) =>
  reading !== null && now.getTime() - reading.readAt.getTime() < FRESH_MS;

/** Keeps a service's latest reading, replacing the one before. */
export async function saveReading(
  source: string,
  data: Record<string, unknown>,
  readAt: Date,
): Promise<void> {
  await db()
    .insert(usageReading)
    .values({ source, data, readAt })
    .onConflictDoUpdate({
      target: usageReading.source,
      set: { data, readAt },
    });
}

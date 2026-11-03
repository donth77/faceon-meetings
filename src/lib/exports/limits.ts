import type { AttemptLimit } from "@/lib/rate-limit";

/**
 * The downloads that read everything (Download your data, Download history) share one
 * budget per account: a few every ten minutes is plenty.
 */
export const exportLimits = (userId: string): AttemptLimit[] => [
  { key: `export:${userId}`, max: 3 },
];

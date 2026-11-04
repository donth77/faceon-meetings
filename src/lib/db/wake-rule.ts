/**
 * Whether pages should wake the database when someone shows intent (focusing the meeting
 * ID field, opening sign-in), so the second it takes to wake from sleep is spent while
 * they type rather than after they press Join. Only a database that sleeps when idle
 * needs it: Neon does by default on every plan, after five quiet minutes, unless that's
 * turned off; most other databases never sleep. Pure, for the tests.
 */
export type WakeSetting = "auto" | "on" | "off";

/** Neon's hosts end in neon.tech, pooled or not. */
export function isNeonDatabase(url: string | undefined): boolean {
  if (!url || !URL.canParse(url)) return false;
  const host = new URL(url).hostname;
  return host === "neon.tech" || host.endsWith(".neon.tech");
}

/** "auto" wakes a Neon database only; "on" and "off" decide outright. */
export function shouldWakeDatabase(
  setting: WakeSetting,
  url: string | undefined,
): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  return isNeonDatabase(url);
}

/**
 * Anything that reaches the database without signing in (/api/wake, and /api/health's
 * ?db=1) does so at most once a window, whoever asks: a sleeping database still wakes for
 * someone about to use FaceOn, but asking over and over can't hold it awake and spend the
 * free plan's compute hours.
 */
export const WAKE_WINDOW_MS = 15 * 60 * 1000;
export const HEALTH_WINDOW_MS = 60 * 60 * 1000;

/** The window a moment falls in, as a number to key a cache by. */
export const windowOf = (now: number, length: number) =>
  Math.floor(now / length);

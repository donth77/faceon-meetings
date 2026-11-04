import { z } from "@/lib/zod";

/**
 * Default avatars (DiceBear "Dylan"): seeds and URLs. Safe in the browser; the look a
 * name suggests comes from name-look.ts.
 */

/** A default avatar's look: feminine-leaning, masculine-leaning or the full mix. */
export type Look = "f" | "m" | "n";

const SEED_PATTERN = /^([a-z0-9]{16})-([fmn])$/;

/** A new random avatar seed carrying the look, e.g. "k3x9…q2-f". */
export function createAvatarSeed(look: Look): string {
  const random = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return `${random}-${look}`;
}

export function parseAvatarSeed(
  value: string,
): { seed: string; look: Look } | null {
  const match = SEED_PATTERN.exec(value);
  if (!match) return null;
  return { seed: match[1] as string, look: match[2] as Look };
}

/** A seed as requests carry it: a guest's choice on the join screen, or Settings → Account's. */
export const AvatarSeed = z
  .string()
  .refine((value) => parseAvatarSeed(value) !== null);

/**
 * The same avatar with another look: a first-time guest's default follows the name they
 * type. Something that isn't a seed gets a new one.
 */
export function withLook(value: string, look: Look): string {
  const parsed = parseAvatarSeed(value);
  return parsed ? `${parsed.seed}-${look}` : createAvatarSeed(look);
}

/** A default avatar's picture. */
export const avatarImage = (seed: string) => `/avatar/${seed}.svg`;

/** A stable fallback seed for accounts created before avatars existed. */
export function fallbackAvatarSeed(userId: string): string {
  let hash = 0x811c9dc5;
  for (const char of userId) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return `${hash.toString(36).padStart(16, "0").slice(-16)}-n`;
}

export type AvatarUser = {
  id: string;
  image?: string | null;
  avatarSeed?: string | null;
  avatarSource?: string | null;
};

/** The avatar to show: the sign-in provider's photo if chosen, otherwise our Dylan avatar. */
export function avatarUrl(user: AvatarUser): string {
  if (user.avatarSource === "provider" && user.image) return user.image;
  return avatarImage(user.avatarSeed ?? fallbackAvatarSeed(user.id));
}

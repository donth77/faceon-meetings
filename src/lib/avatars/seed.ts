import nameLooks from "./name-looks.json";

/** A default avatar's look: feminine-leaning, masculine-leaning or the full mix. */
export type Look = "f" | "m" | "n";

const FEMININE = new Set(nameLooks.f);
const MASCULINE = new Set(nameLooks.m);
const SEED_PATTERN = /^([a-z0-9]{16})-([fmn])$/;

/**
 * The look a first name suggests, only to pick a default avatar. Unisex, rare and
 * non-Latin names get the full mix ("n"); nothing is stored or shown as a gender.
 */
export function lookForName(name: string): Look {
  const first = (name.trim().split(/\s+/)[0] ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (FEMININE.has(first)) return "f";
  if (MASCULINE.has(first)) return "m";
  return "n";
}

/** A new random avatar seed carrying the look, e.g. "k3x9…q2-f". */
export function createAvatarSeed(
  name: string,
  look = lookForName(name),
): string {
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
  return `/avatar/${user.avatarSeed ?? fallbackAvatarSeed(user.id)}.svg`;
}

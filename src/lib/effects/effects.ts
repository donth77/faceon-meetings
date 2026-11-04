/**
 * Backgrounds and effects: what someone can choose, as kept on their device (Settings →
 * Backgrounds and effects). The video is processed on the device, by engine/.
 */

export const BLUR_LEVELS = ["slight", "strong"] as const;
export type BlurLevel = (typeof BLUR_LEVELS)[number];

export const STILL_GROUPS = ["art", "places", "abstract"] as const;
export type StillGroup = (typeof STILL_GROUPS)[number];

/** Where a default background comes from: the public domain, CC0, or drawn for FaceOn. */
export type BackgroundLicense = "publicDomain" | "cc0" | "ours";

/**
 * The default still backgrounds, in public/backgrounds/ (CREDITS.md there lists each
 * source). Public domain first, then our own, drawn as SVG by scripts/backgrounds.ts.
 */
export const STILLS = [
  { id: "oxbow", group: "art", by: "Thomas Cole", license: "publicDomain" },
  {
    id: "wheat-field",
    group: "art",
    by: "Vincent van Gogh",
    license: "publicDomain",
  },
  {
    id: "great-wave",
    group: "art",
    by: "Katsushika Hokusai",
    license: "publicDomain",
  },
  {
    id: "andes",
    group: "art",
    by: "Frederic Edwin Church",
    license: "publicDomain",
  },
  {
    id: "library",
    group: "places",
    by: "Carol M. Highsmith",
    license: "publicDomain",
  },
  {
    id: "valley",
    group: "places",
    by: "Carol M. Highsmith",
    license: "publicDomain",
  },
  { id: "earth", group: "places", by: "NASA", license: "publicDomain" },
  {
    id: "coast",
    group: "places",
    by: "Carol M. Highsmith",
    license: "publicDomain",
  },
  { id: "blue", group: "abstract", by: "FaceOn", license: "ours" },
  { id: "mint", group: "abstract", by: "FaceOn", license: "ours" },
  { id: "dusk", group: "abstract", by: "FaceOn", license: "ours" },
  { id: "graphite", group: "abstract", by: "FaceOn", license: "ours" },
] as const satisfies ReadonlyArray<{
  id: string;
  group: StillGroup;
  by: string;
  license: BackgroundLicense;
}>;
export type StillId = (typeof STILLS)[number]["id"];
const STILL_IDS = STILLS.map((still) => still.id) as [StillId, ...StillId[]];

/** Our own backgrounds are SVG; the photos and paintings are WebP, with thumbnails. */
const drawn = (id: StillId) =>
  STILLS.find((still) => still.id === id)?.license === "ours";

/** The full image, and the small one the picker shows. */
export const stillFile = (id: StillId) =>
  `/backgrounds/${id}.${drawn(id) ? "svg" : "webp"}`;
export const stillThumb = (id: StillId) =>
  drawn(id) ? stillFile(id) : `/backgrounds/thumbs/${id}.webp`;

/**
 * Moving backgrounds: public-domain and CC0 footage cut into seamless loops, in
 * public/backgrounds/motion/ (CREDITS.md in public/backgrounds/ lists each source).
 */
export const MOTIONS = [
  { id: "aurora", by: "Fritzchens Fritz", license: "cc0" },
  { id: "orbit", by: "NASA", license: "publicDomain" },
  { id: "lake", by: "NPS / Jacob W. Frank", license: "publicDomain" },
  { id: "waterfall", by: "NPS / Jacob W. Frank", license: "publicDomain" },
  { id: "clouds", by: "Stepleton", license: "cc0" },
  { id: "sunrise", by: "NPS / Jacob W. Frank", license: "publicDomain" },
] as const satisfies ReadonlyArray<{
  id: string;
  by: string;
  license: BackgroundLicense;
}>;
export type MotionId = (typeof MOTIONS)[number]["id"];
const MOTION_IDS = MOTIONS.map((motion) => motion.id) as [
  MotionId,
  ...MotionId[],
];

/** The looping video (H.264 in MP4), and the still the picker shows. */
export const motionFile = (id: MotionId) => `/backgrounds/motion/${id}.mp4`;
export const motionThumb = (id: MotionId) => `/backgrounds/motion/${id}.webp`;

/** Images and looping videos people add; kept in their browser (uploads.ts). */
const UPLOAD_ID = /^[a-z0-9-]{1,64}$/;

/** A background or effect; null is none. */
export type Effect =
  | { kind: "blur"; level: BlurLevel }
  | { kind: "still"; id: StillId }
  | { kind: "motion"; id: MotionId }
  | { kind: "upload"; id: string };

const isOneOf = <T extends string>(list: readonly T[], value: unknown) =>
  list.find((item) => item === value);

/**
 * A stored choice as an effect, or null when it isn't one we offer (a retired background,
 * a typo, anything else). Plain checks rather than a schema library: preferences read it
 * on every page, and this keeps that light.
 */
export function parseEffect(value: unknown): Effect | null {
  if (!value || typeof value !== "object") return null;
  const { kind, level, id } = value as Record<string, unknown>;
  if (kind === "blur") {
    const found = isOneOf(BLUR_LEVELS, level);
    return found ? { kind, level: found } : null;
  }
  if (kind === "still") {
    const found = isOneOf(STILL_IDS, id);
    return found ? { kind, id: found } : null;
  }
  if (kind === "motion") {
    const found = isOneOf(MOTION_IDS, id);
    return found ? { kind, id: found } : null;
  }
  if (kind === "upload" && typeof id === "string" && UPLOAD_ID.test(id)) {
    return { kind, id };
  }
  return null;
}

/** One string per choice, for the picker's radio values; "none" for no effect. */
export function effectKey(effect: Effect | null): string {
  if (!effect) return "none";
  return effect.kind === "blur"
    ? `blur:${effect.level}`
    : `${effect.kind}:${effect.id}`;
}

/** The choice a key stands for; null for "none" or anything unknown. */
export function effectFromKey(key: string): Effect | null {
  const at = key.indexOf(":");
  if (at < 0) return null;
  const kind = key.slice(0, at);
  const value = key.slice(at + 1);
  return parseEffect(
    kind === "blur" ? { kind, level: value } : { kind, id: value },
  );
}

export const sameEffect = (a: Effect | null, b: Effect | null) =>
  effectKey(a) === effectKey(b);

/**
 * The effect if this device can run it, otherwise null (no effect): every effect needs
 * the engine, and motion backgrounds also need a browser that plays their footage.
 */
export function runnableEffect(
  effect: Effect | null,
  device: { effects: boolean; footage: boolean },
): Effect | null {
  if (!effect || !device.effects) return null;
  return effect.kind === "motion" && !device.footage ? null : effect;
}

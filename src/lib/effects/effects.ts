import { z } from "zod";

/**
 * Backgrounds and effects: what someone can choose, as kept on their device (Settings →
 * Backgrounds and effects). The video is processed on the device, by engine/.
 */

export const BLUR_LEVELS = ["slight", "strong"] as const;
export type BlurLevel = (typeof BLUR_LEVELS)[number];

/** Moving backgrounds, drawn live by small shaders, so they need no download. */
export const MOTION_IDS = ["aurora", "waves", "bokeh", "drift"] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export const STILL_GROUPS = ["art", "places", "abstract"] as const;
export type StillGroup = (typeof STILL_GROUPS)[number];

export type StillLicense = "publicDomain" | "cc0" | "ours";

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
  license: StillLicense;
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

/** Images and looping videos people add; kept in their browser (uploads.ts). */
export const UPLOAD_ID = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const Effect = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("blur"), level: z.enum(BLUR_LEVELS) }),
  z.object({ kind: z.literal("still"), id: z.enum(STILL_IDS) }),
  z.object({ kind: z.literal("motion"), id: z.enum(MOTION_IDS) }),
  z.object({ kind: z.literal("upload"), id: UPLOAD_ID }),
]);
/** A background or effect; null is none. */
export type Effect = z.infer<typeof Effect>;

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
  const parsed = Effect.safeParse(
    kind === "blur" ? { kind, level: value } : { kind, id: value },
  );
  return parsed.success ? parsed.data : null;
}

export const sameEffect = (a: Effect | null, b: Effect | null) =>
  effectKey(a) === effectKey(b);

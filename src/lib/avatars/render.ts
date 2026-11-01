import "server-only";

import { Avatar, Style } from "@dicebear/core";
import dylan from "@dicebear/styles/dylan.json";

import type { Look } from "./seed";

/**
 * DiceBear's "Dylan" style: a remix of "Dylan! The Avatar Generator" by Natalia Spivak,
 * licensed CC BY 4.0 (credited in the footer). DiceBear's code is MIT.
 */
const style = new Style(dylan);

const FEMININE_HAIR = [
  "longCurls",
  "buns",
  "roundBob",
  "wavy",
  "bangs",
] as const;
const MASCULINE_HAIR = [
  "flatTop",
  "spiky",
  "shortCurls",
  "parting",
  "plain",
  "shaggy",
] as const;
/** Friendly faces only: never angry, sad or confused. */
const MOODS = ["happy", "superHappy", "hopeful", "neutral"] as const;

function optionsFor(look: Look) {
  if (look === "f")
    return { hairVariant: FEMININE_HAIR, facialHairProbability: 0 };
  if (look === "m")
    return { hairVariant: MASCULINE_HAIR, facialHairProbability: 33 };
  return {};
}

/** Renders a Dylan avatar SVG. The same seed always gives the same face. */
export function renderAvatarSvg(seed: string, look: Look): string {
  return new Avatar(style, {
    seed,
    moodVariant: MOODS,
    ...optionsFor(look),
  }).toString();
}

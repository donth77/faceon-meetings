import nameLooks from "./name-looks.json";
import type { Look } from "./seed";

const FEMININE = new Set(nameLooks.f);
const MASCULINE = new Set(nameLooks.m);

/**
 * The look a first name suggests, only to pick a default avatar. Unisex, rare and
 * non-Latin names get the full mix ("n"); nothing is stored or shown as a gender.
 * The list of names is 37 KB, so a browser loads it only when it needs it, with
 * `import()` (a first-time guest's join screen); never import this statically there.
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

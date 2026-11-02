import "server-only";

import nameLooks from "./name-looks.json";
import type { Look } from "./seed";

const FEMININE = new Set(nameLooks.f);
const MASCULINE = new Set(nameLooks.m);

/**
 * The look a first name suggests, only to pick a default avatar. Unisex, rare and
 * non-Latin names get the full mix ("n"); nothing is stored or shown as a gender.
 * Server-only: the list of names is too big to send to browsers.
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

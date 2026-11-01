/**
 * Builds src/lib/avatars/name-looks.json: first names that lean strongly female or male,
 * which only bias a default avatar's look. Nothing about a person is stored or shown
 * as a gender.
 *
 * Source: US Social Security Administration baby-name statistics (public domain), via
 * Hadley Wickham's data-baby-names (top 1,000 names per sex per year, 1880–2008).
 * Usage: node scripts/build-name-looks.ts
 */
import { writeFileSync } from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/hadley/data-baby-names/master/baby-names.csv";
/** A name leans one way only when at least this share of its births are that sex. */
const LEAN = 0.9;
/** Ignore rare names: summed yearly share of births, roughly "popular for a few years". */
const MIN_POPULARITY = 0.002;
/** Weight recent decades more, since they match today's adults and children. */
const weight = (year: number) => (year >= 1950 ? 1 : 0.25);

const csv = await (await fetch(SOURCE)).text();
const totals = new Map<string, { girl: number; boy: number }>();

for (const line of csv.split("\n").slice(1)) {
  const [year, quotedName, percent, quotedSex] = line.split(",");
  if (!year || !quotedName || !percent || !quotedSex) continue;
  const name = quotedName.replaceAll('"', "").toLowerCase();
  const sex = quotedSex.replaceAll('"', "").trim();
  const share = Number(percent) * weight(Number(year));
  const entry = totals.get(name) ?? { girl: 0, boy: 0 };
  if (sex === "girl") entry.girl += share;
  else if (sex === "boy") entry.boy += share;
  totals.set(name, entry);
}

const feminine: string[] = [];
const masculine: string[] = [];
for (const [name, { girl, boy }] of totals) {
  const total = girl + boy;
  if (total < MIN_POPULARITY) continue;
  if (girl / total >= LEAN) feminine.push(name);
  else if (boy / total >= LEAN) masculine.push(name);
}

const output = {
  source: SOURCE,
  lean: LEAN,
  f: feminine.sort(),
  m: masculine.sort(),
};
writeFileSync("src/lib/avatars/name-looks.json", `${JSON.stringify(output)}\n`);
console.log(`feminine: ${feminine.length}, masculine: ${masculine.length}`);

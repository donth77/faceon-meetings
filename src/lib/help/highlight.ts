/**
 * Finding a Help search in the article it opened, so the article can highlight it.
 * Pure: the page walks its own text and wraps what this finds (help-highlights.tsx).
 *
 * The article's text comes as runs: stretches a match may cross, such as one
 * paragraph's text split where its links and bold split it ("Turn on **push to
 * talk**"). Runs end at paragraphs, list items, headings and cells, and around
 * anything that's never highlighted, so a match never joins two of them.
 */
import { foldWithOffsets, meaningfulWords, wordsIn } from "./text";

/** Part of a match inside one piece of text: run, segment, and where in it. */
export type MatchPiece = {
  run: number;
  segment: number;
  start: number;
  end: number;
};

/** One match, in one piece or several (when it crosses an element). */
export type Match = MatchPiece[];

export type Matches = {
  /** The whole query was found, or, when it wasn't, its words one by one. */
  mode: "phrase" | "words";
  matches: Match[];
};

/** The longest query worth looking for; longer ones are cut. */
export const MAX_QUERY_LENGTH = 100;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Scripts that put spaces between words, where matches keep to word boundaries. */
const SPACED = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{N}]+$/u;

/**
 * A word must start a word in the text ("push" doesn't match "repush"), and a short
 * one must be the whole word ("m" isn't the start of "mute"), except in scripts
 * written without spaces, where words aren't separated. Longer words may end inside
 * a longer one: "talk" finds "talking".
 */
const startOfWord = (word: string) =>
  SPACED.test(word) ? "(?<![\\p{L}\\p{N}])" : "";
const endOfWord = (word: string) =>
  SPACED.test(word) && word.length < 3 ? "(?![\\p{L}\\p{N}])" : "";

/** The whole phrase, its words apart by any short gap: "push-to-talk", "push to talk". */
function phrasePattern(words: string[]): RegExp | null {
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last) return null;
  return new RegExp(
    startOfWord(first) +
      words.map(escape).join("[^\\p{L}\\p{N}]{1,3}") +
      endOfWord(last),
    "gu",
  );
}

/** Any one of the words, longest first, so "notes" wins over "note" at the same place. */
function wordsPattern(words: string[]): RegExp | null {
  if (!words.length) return null;
  const sorted = [...words].sort((a, b) => b.length - a.length);
  return new RegExp(
    sorted
      .map((word) => startOfWord(word) + escape(word) + endOfWord(word))
      .join("|"),
    "gu",
  );
}

/** Every match of `pattern` in the runs, mapped back to their segments. */
function search(
  runs: readonly (readonly string[])[],
  pattern: RegExp,
): Match[] {
  const found: Match[] = [];
  runs.forEach((segments, run) => {
    const text = segments.join("");
    if (!text) return;
    const { folded, offsets } = foldWithOffsets(text);
    for (const hit of folded.matchAll(pattern)) {
      const from = offsets[hit.index] ?? 0;
      const to = offsets[hit.index + hit[0].length] ?? text.length;
      if (to <= from) continue;
      const match: Match = [];
      let segmentStart = 0;
      segments.forEach((segment, index) => {
        const segmentEnd = segmentStart + segment.length;
        const start = Math.max(from, segmentStart);
        const end = Math.min(to, segmentEnd);
        if (start < end) {
          match.push({
            run,
            segment: index,
            start: start - segmentStart,
            end: end - segmentStart,
          });
        }
        segmentStart = segmentEnd;
      });
      if (match.length) found.push(match);
    }
  });
  return found;
}

/**
 * Where a Help search appears in an article: the whole phrase if it's there ("push to
 * talk"), otherwise each of its words that carries meaning ("push", "talk"; never
 * "to"). Case and accents don't matter, as in the search. Matches come in reading
 * order and never overlap.
 */
export function findMatches(
  runs: readonly (readonly string[])[],
  query: string,
): Matches {
  const cut = query.trim().slice(0, MAX_QUERY_LENGTH);
  const phrase = phrasePattern(wordsIn(cut));
  if (!phrase) return { mode: "phrase", matches: [] };
  const whole = search(runs, phrase);
  if (whole.length) return { mode: "phrase", matches: whole };
  const words = wordsPattern(meaningfulWords(cut));
  return { mode: "words", matches: words ? search(runs, words) : [] };
}

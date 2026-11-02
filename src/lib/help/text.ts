/**
 * How Help compares words, everywhere it looks for them (the search, the assistant and
 * the highlights in an article), so they always agree: case and accents set aside, so
 * "ecran" finds "Écran".
 */

const MARKS = /[̀-ͯ]/g;

/** Text folded for comparing: lower case, without accents. */
export const fold = (text: string): string =>
  text.normalize("NFKD").replace(MARKS, "").normalize("NFKC").toLowerCase();

/**
 * `text` folded, with where each folded character came from: `offsets[i]` is the
 * position in `text` of folded character `i`, and the last entry is `text`'s length.
 * A match found in the folded text maps back to the original this way, even where
 * folding changed its length.
 */
export function foldWithOffsets(text: string): {
  folded: string;
  offsets: number[];
} {
  let folded = "";
  const offsets: number[] = [];
  let at = 0;
  for (const char of text) {
    const piece = fold(char);
    for (let i = 0; i < piece.length; i++) offsets.push(at);
    folded += piece;
    at += char.length;
  }
  offsets.push(at);
  return { folded, offsets };
}

/** Words in almost every question, which say nothing about what it's about. */
export const QUESTION_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "for",
  "how",
  "can",
  "does",
  "what",
  "where",
  "why",
  "when",
  "which",
  "who",
  "you",
  "your",
  "with",
  "this",
  "that",
  "there",
  "are",
  "was",
  "not",
  "but",
  "get",
  "make",
  "use",
  "want",
  "need",
  "about",
]);

/** Those, and the short words that join others ("push to talk"'s "to"). */
const STOP_WORDS: ReadonlySet<string> = new Set([
  ...QUESTION_WORDS,
  "a",
  "an",
  "as",
  "at",
  "be",
  "by",
  "do",
  "from",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "of",
  "on",
  "or",
  "so",
  "to",
  "up",
  "we",
]);

/** A query's words, folded: letters and digits, whatever separates them. */
export const wordsIn = (query: string): string[] =>
  fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * The words of a query that carry meaning, folded and without repeats: what to look
 * for one by one when the whole phrase isn't there. Words like "to" and "the" are
 * left out, and so are single Latin letters; a single character of a script written
 * without spaces (Japanese, Chinese) is a word.
 */
export const meaningfulWords = (query: string): string[] => [
  ...new Set(
    wordsIn(query).filter(
      (word) =>
        !STOP_WORDS.has(word) &&
        (word.length > 1 || !/^[\p{Script=Latin}\p{N}]$/u.test(word)),
    ),
  ),
];

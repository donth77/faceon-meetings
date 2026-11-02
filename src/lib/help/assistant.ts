/**
 * Ask Help a question, answered by the model Chrome carries (Gemini Nano, through the
 * Prompt API), on the reader's own device.
 *
 * The model is small, so it isn't asked from memory. The question picks the few help
 * articles that come nearest, those go into the prompt, and the model is told to answer
 * from them alone. A question the help has nothing near is answered without the model.
 *
 * Shown only where it can work: where the model is ready, the box; where it can be
 * had, a callout with a button to get it; elsewhere nothing, because the help and its
 * search are all there is.
 */
import { optionsFor, type ModelApi } from "@/lib/ai/built-in";

import { fold, QUESTION_WORDS } from "./text";

/** One thing the model may answer from: a help article. */
export interface Doc {
  slug: string;
  title: string;
  /** The article's summary, which says what it's for. */
  keywords: string;
  text: string;
}

/** Scripts written without spaces between words, searched by pairs of characters. */
const UNSPACED = /[฀-๿぀-ヿ㐀-鿿가-힯]+/gu;

/** What a question is about, as words to look for: words, their stems, and pairs of characters. */
export function wordsOf(question: string): string[] {
  const text = fold(question);
  const out = new Set<string>();
  for (const run of text.match(UNSPACED) ?? []) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
  }
  for (const word of text.replace(UNSPACED, " ").split(/[^\p{L}\p{N}]+/u)) {
    if (word.length < 3 || QUESTION_WORDS.has(word)) continue;
    out.add(word);
    const stem = word.replace(/(ing|ed|es|s)$/, "");
    if (stem.length >= 4) out.add(stem);
  }
  return [...out];
}

/** The articles nearest the question, nearest first; none where nothing shares a word. */
export function nearest(
  docs: readonly Doc[],
  question: string,
  count = 4,
): Doc[] {
  const words = wordsOf(question);
  return docs
    .map((doc) => {
      const title = fold(doc.title);
      const keywords = fold(doc.keywords);
      const text = fold(doc.text);
      let score = 0;
      for (const word of words) {
        if (title.includes(word)) score += 3;
        if (keywords.includes(word)) score += 2;
        if (text.includes(word)) score += 1;
      }
      return { doc, score };
    })
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((scored) => scored.doc);
}

/** How many of Help's opening articles answer a question about nothing in particular. */
const OPENING = 3;

/** Words a question about the whole app is made of: "What can you help with?" */
const GENERAL = new Set([
  "help",
  "helps",
  "helping",
  "about",
  "use",
  "using",
  "app",
  "feature",
  "features",
  "overview",
  "work",
  "works",
  "working",
  "begin",
  "faceon",
  "know",
  "learn",
  "do",
  "does",
  "capable",
  "offer",
  "support",
  "have",
  "has",
  "show",
  "tell",
]);

/**
 * What to answer from. A question with something in it goes by that. One with nothing
 * in it, like "What can you do?", is about the app as a whole, which Help's first
 * articles are for. Nothing at all where the question has words Help doesn't.
 */
export function relevant(docs: readonly Doc[], question: string): Doc[] {
  const words = wordsOf(question);
  // A word counts whole or as the stem it was cut to: "features" is "featur" here.
  const general = words.every((word) =>
    [...GENERAL].some(
      (g) => g === word || (word.length >= 5 && g.startsWith(word)),
    ),
  );
  return words.length && !general
    ? nearest(docs, question)
    : docs.slice(0, OPENING);
}

/** The most of one article that goes into the prompt: the model's room is small. */
const EACH = 1400;

export const SYSTEM =
  "You answer questions about FaceOn, a free, open-source video meeting app that runs " +
  "in the browser, like Zoom or Google Meet. People start or schedule meetings, join " +
  "with a link or a meeting ID, share their screen, chat, react and raise their hand. " +
  "Hosts let people in from the waiting room and manage the meeting with host controls. " +
  "Settings and Help are pages of the app. " +
  "Answer only from the help text you are given. If it doesn't say, say so; never guess " +
  "or invent features. Name buttons and menus exactly as the help does. Use short, " +
  "plain sentences.";

export function promptFor(question: string, docs: readonly Doc[]): string {
  const help = docs
    .map((doc) => `## ${doc.title}\n${doc.text.slice(0, EACH)}`)
    .join("\n\n");
  return `Help text:\n\n${help}\n\nQuestion: ${question}`;
}

/** Asks once: a fresh session, so one answer never crowds the next out of the model's room. */
export async function* ask(
  api: ModelApi,
  language: string,
  question: string,
  docs: readonly Doc[],
): AsyncGenerator<string> {
  const session = await api.create({
    ...optionsFor(language),
    initialPrompts: [{ role: "system", content: SYSTEM }],
  });
  try {
    const reader = session
      .promptStreaming(promptFor(question, docs))
      .getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    session.destroy();
  }
}

/**
 * Whether the reader closed the callout. Kept in this browser's storage, so it stays
 * closed until that's cleared: a convenience, so a browser that won't store it just
 * shows the callout again.
 */
const DISMISSED = "faceon.helpChatDismissed";
export function calloutDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}
export function dismissCallout(): void {
  try {
    localStorage.setItem(DISMISSED, "1");
  } catch {
    // Shown again next time.
  }
}

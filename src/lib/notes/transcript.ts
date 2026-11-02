/**
 * The AI notes transcript: lines from everyone's devices, collected in the notetaker's
 * browser, and the notes made from it. Both stay in that tab (session storage), so a
 * reload keeps them and closing the tab forgets them; nothing is saved anywhere unless
 * the host chooses.
 */
import { z } from "zod";

import { ENGINES, MeetingNotes } from "./notes";
import { PROVIDERS } from "./providers";

export const TranscriptLine = z.object({
  id: z.string(),
  speakerId: z.string(),
  speaker: z.string(),
  text: z.string(),
  /** When it arrived (ms since epoch). */
  at: z.number(),
  /** The language it was heard in (BCP 47). */
  lang: z.string(),
});
export type TranscriptLine = z.infer<typeof TranscriptLine>;

/** About 30,000 words, more than three hours of talk; later lines are dropped. */
export const MAX_TRANSCRIPT_CHARS = 180_000;

/** The transcript's length, as the summary and saving count it. */
export const transcriptLength = (lines: readonly TranscriptLine[]) =>
  lines.reduce((total, line) => total + line.text.length, 0);

/**
 * Adds a line unless it's a repeat delivery, or the transcript is already as long as
 * it may grow. Returns the same array when nothing changed.
 */
export function addLine(
  lines: readonly TranscriptLine[],
  line: TranscriptLine,
): readonly TranscriptLine[] {
  if (lines.some((l) => l.id === line.id)) return lines;
  if (transcriptLength(lines) + line.text.length > MAX_TRANSCRIPT_CHARS) {
    return lines;
  }
  return [...lines, line];
}

/** A pause this long starts a new block, even when the same person goes on. */
export const BLOCK_PAUSE_MS = 30_000;
/** A block runs this long at most, so a long stretch reads as paragraphs, each timed. */
export const BLOCK_MAX_MS = 60_000;
/** …and this many words at most. */
export const BLOCK_MAX_WORDS = 120;

/**
 * A block of the transcript: one speaker's lines in a row, shown and written together
 * under their name and the time, until they pause or it runs long.
 */
export type Turn = {
  key: string;
  speakerId: string;
  speaker: string;
  at: number;
  text: string;
};

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function turnsOf(lines: readonly TranscriptLine[]): Turn[] {
  const turns: Turn[] = [];
  /** The block being added to: its last line's time, and its words so far. */
  let open: { turn: Turn; lastAt: number; words: number } | null = null;
  for (const line of lines) {
    const words = wordCount(line.text);
    if (
      open &&
      open.turn.speakerId === line.speakerId &&
      line.at - open.lastAt < BLOCK_PAUSE_MS &&
      line.at - open.turn.at < BLOCK_MAX_MS &&
      open.words + words <= BLOCK_MAX_WORDS
    ) {
      open.turn.text = `${open.turn.text} ${line.text}`;
      open.lastAt = line.at;
      open.words += words;
      continue;
    }
    const turn: Turn = {
      key: line.id,
      speakerId: line.speakerId,
      speaker: line.speaker,
      at: line.at,
      text: line.text,
    };
    turns.push(turn);
    open = { turn, lastAt: line.at, words };
  }
  return turns;
}

/** The transcript as plain text, one block a paragraph: "Ana (10:02): …". */
export function transcriptText(
  lines: readonly TranscriptLine[],
  time: (at: number) => string,
): string {
  return turnsOf(lines)
    .map((turn) => `${turn.speaker} (${time(turn.at)}): ${turn.text}`)
    .join("\n\n");
}

const storageKey = (sessionId: string) => `faceon.transcript.${sessionId}`;
const Stored = z.array(TranscriptLine);

/** The transcript this tab collected in a session; empty when there's none. */
export function loadTranscript(sessionId: string): TranscriptLine[] {
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    const parsed = Stored.safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Keeps it for a reload; a browser that won't store it just keeps it in memory. */
export function saveTranscript(
  sessionId: string,
  lines: readonly TranscriptLine[],
): void {
  try {
    if (lines.length === 0) sessionStorage.removeItem(storageKey(sessionId));
    else sessionStorage.setItem(storageKey(sessionId), JSON.stringify(lines));
  } catch {
    // Kept in memory only.
  }
}

const turnedOffKey = (sessionId: string) =>
  `faceon.transcript.${sessionId}.turnedOff`;

/**
 * The meeting's host turned AI notes off for their meetings while this tab had a
 * transcript: notes are made from it only when asked, in the room or after it.
 */
export function markNotesTurnedOff(sessionId: string, off: boolean): void {
  try {
    if (off) sessionStorage.setItem(turnedOffKey(sessionId), "1");
    else sessionStorage.removeItem(turnedOffKey(sessionId));
  } catch {
    // Without storage, notes after the meeting are made as usual.
  }
}

export function notesTurnedOff(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(turnedOffKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

/** Notes made from the transcript in this tab: what they say, how, and when. */
export const MadeNotes = z.object({
  notes: MeetingNotes,
  engine: z.enum(ENGINES),
  provider: z.enum(PROVIDERS).optional(),
  /** When they were made (ms since epoch). */
  madeAt: z.number(),
  /** Saved to the meeting from this tab, shared or not. */
  saved: z.object({ shared: z.boolean() }).optional(),
});
export type MadeNotes = z.infer<typeof MadeNotes>;

/**
 * Notes made before the last of the transcript: AI notes went on again after they were
 * made, so they leave the rest out.
 */
export const notesOutdated = (
  made: MadeNotes,
  lines: readonly TranscriptLine[],
): boolean => lines.some((line) => line.at > made.madeAt);

const notesKey = (sessionId: string) => `faceon.notes.${sessionId}`;

export function loadMadeNotes(sessionId: string): MadeNotes | null {
  try {
    const raw = sessionStorage.getItem(notesKey(sessionId));
    const parsed = MadeNotes.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveMadeNotes(sessionId: string, made: MadeNotes | null): void {
  try {
    if (made) sessionStorage.setItem(notesKey(sessionId), JSON.stringify(made));
    else sessionStorage.removeItem(notesKey(sessionId));
  } catch {
    // Kept in memory only.
  }
}

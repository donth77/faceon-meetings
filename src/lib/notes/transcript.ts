/**
 * The AI notes transcript: lines from everyone's devices, collected in the notetaker's
 * browser. It stays in that tab (session storage), so a reload keeps it and closing the
 * tab forgets it; nothing is saved anywhere unless the host chooses.
 */
import { z } from "zod";

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

/** One speaker's turn: their lines in a row, shown and written together. */
export type Turn = {
  key: string;
  speakerId: string;
  speaker: string;
  at: number;
  text: string;
};

export function turnsOf(lines: readonly TranscriptLine[]): Turn[] {
  const turns: Turn[] = [];
  for (const line of lines) {
    const last = turns.at(-1);
    if (last && last.speakerId === line.speakerId) {
      last.text = `${last.text} ${line.text}`;
    } else {
      turns.push({
        key: line.id,
        speakerId: line.speakerId,
        speaker: line.speaker,
        at: line.at,
        text: line.text,
      });
    }
  }
  return turns;
}

/** The transcript as plain text, one turn a paragraph: "Ana (10:02): …". */
export function transcriptText(
  lines: readonly TranscriptLine[],
  time: (at: number) => string,
): string {
  return turnsOf(lines)
    .map((turn) => `${turn.speaker} (${time(turn.at)}): ${turn.text}`)
    .join("\n\n");
}

const storageKey = (code: string) => `faceon.transcript.${code}`;
const Stored = z.array(TranscriptLine);

/** The transcript this tab collected for a meeting; empty when there's none. */
export function loadTranscript(code: string): TranscriptLine[] {
  try {
    const raw = sessionStorage.getItem(storageKey(code));
    const parsed = Stored.safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Keeps it for a reload; a browser that won't store it just keeps it in memory. */
export function saveTranscript(
  code: string,
  lines: readonly TranscriptLine[],
): void {
  try {
    if (lines.length === 0) sessionStorage.removeItem(storageKey(code));
    else sessionStorage.setItem(storageKey(code), JSON.stringify(lines));
  } catch {
    // Kept in memory only.
  }
}

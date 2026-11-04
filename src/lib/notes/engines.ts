/**
 * Making AI notes from a transcript, in the notetaker's browser: on this computer with
 * Chrome's built-in model, or with the host's own AI key, straight to its provider.
 */
import {
  baseLanguage,
  modelWrites,
  onDeviceNotesLanguage,
  optionsFor,
  type ModelApi,
  type ModelState,
} from "@/lib/ai/built-in";

import {
  chunkText,
  mergePrompt,
  NOTES_SCHEMA,
  parseNotes,
  systemPrompt,
  transcriptPrompt,
  type EngineId,
  type MeetingNotes,
} from "./notes";
import { callProvider, defaultModel, type ProviderId } from "./providers";
import type { NotesSettings } from "./settings";

/** How far along the notes are. */
export type NotesProgress =
  /** Getting Chrome's model, from 0 to 1. */
  | { phase: "download"; done: number }
  /** Reading the transcript, in parts for a long meeting. */
  | { phase: "reading"; part: number; parts: number }
  /** Putting the parts' notes together. */
  | { phase: "merging" };

/** The model answered with something that isn't notes. */
export class UnreadableNotesError extends Error {
  constructor() {
    super("The answer wasn't notes.");
    this.name = "UnreadableNotesError";
  }
}

/**
 * The most transcript the built-in model reads at once: it takes in a few thousand
 * tokens, and Japanese takes about one per character.
 */
const partSize = (language: string) => (language === "ja" ? 4000 : 10_000);

/** Packs notes into groups small enough to merge in one go. */
function groupsOf(parts: readonly MeetingNotes[], max: number) {
  const groups: MeetingNotes[][] = [];
  let size = 0;
  for (const notes of parts) {
    const length = JSON.stringify(notes).length;
    const last = groups.at(-1);
    if (last && size + length <= max) {
      last.push(notes);
      size += length;
    } else {
      groups.push([notes]);
      size = length;
    }
  }
  return groups;
}

/**
 * Notes on this computer. A long meeting is read in parts, each with a fresh session,
 * and the parts' notes are merged, a few at a time, into one set.
 */
export async function notesOnDevice(input: {
  api: ModelApi;
  locale: string;
  title: string;
  transcript: string;
  signal: AbortSignal;
  onProgress: (progress: NotesProgress) => void;
}): Promise<MeetingNotes> {
  // The person's language where the model writes it, else English.
  const { language } = onDeviceNotesLanguage(
    input.locale,
    await modelWrites(input.api, baseLanguage(input.locale)),
  );
  const system = systemPrompt(language);
  const max = partSize(language);

  async function ask(prompt: string): Promise<MeetingNotes> {
    const session = await input.api.create({
      ...optionsFor(language),
      initialPrompts: [{ role: "system", content: system }],
      signal: input.signal,
      monitor: (monitor) =>
        monitor.addEventListener("downloadprogress", (event) =>
          input.onProgress({
            phase: "download",
            done: (event as ProgressEvent).loaded,
          }),
        ),
    });
    try {
      const answer = await session.prompt(prompt, {
        responseConstraint: NOTES_SCHEMA,
        signal: input.signal,
      });
      const notes = parseNotes(answer);
      if (!notes) throw new UnreadableNotesError();
      return notes;
    } finally {
      session.destroy();
    }
  }

  const pieces = chunkText(input.transcript, max);
  let notes: MeetingNotes[] = [];
  for (const [index, piece] of pieces.entries()) {
    input.onProgress({
      phase: "reading",
      part: index + 1,
      parts: pieces.length,
    });
    notes.push(
      await ask(
        transcriptPrompt({
          title: input.title,
          transcript: piece,
          ...(pieces.length > 1
            ? { part: { index: index + 1, count: pieces.length } }
            : {}),
        }),
      ),
    );
  }
  while (notes.length > 1) {
    input.onProgress({ phase: "merging" });
    const groups = groupsOf(notes, max);
    // Nothing fits together: keep the first part's notes rather than loop forever.
    if (groups.length === notes.length) return notes[0] as MeetingNotes;
    const merged: MeetingNotes[] = [];
    for (const group of groups) {
      merged.push(
        group.length === 1
          ? (group[0] as MeetingNotes)
          : await ask(mergePrompt(input.title, group)),
      );
    }
    notes = merged;
  }
  const [only] = notes;
  if (!only) throw new UnreadableNotesError();
  return only;
}

/** Notes from the host's AI provider, in one call; their models read long meetings whole. */
export async function notesWithKey(input: {
  provider: ProviderId;
  model: string;
  key: string;
  locale: string;
  title: string;
  transcript: string;
  signal: AbortSignal;
  onProgress: (progress: NotesProgress) => void;
}): Promise<MeetingNotes> {
  input.onProgress({ phase: "reading", part: 1, parts: 1 });
  const answer = await callProvider(
    {
      provider: input.provider,
      key: input.key,
      model: input.model,
      system: systemPrompt(input.locale),
      prompt: transcriptPrompt({
        title: input.title,
        transcript: input.transcript,
      }),
    },
    input.signal,
  );
  const notes = parseNotes(answer);
  if (!notes) throw new UnreadableNotesError();
  return notes;
}

/** Tries a key (and model) with a tiny request; throws the provider's failure. */
export async function testKey(input: {
  provider: ProviderId;
  model: string;
  key: string;
}): Promise<void> {
  await callProvider({
    ...input,
    system: "Reply with OK.",
    prompt: "OK?",
    brief: true,
  });
}

/** The provider and model notes use, from the settings. */
export function providerChoice(settings: NotesSettings) {
  const provider = settings.provider ?? "openai";
  return {
    provider,
    model: settings.models?.[provider] ?? defaultModel(provider),
    key: settings.keys?.[provider] ?? "",
  };
}

/**
 * Chrome's built-in AI can make notes in this browser: it's ready, or will be after its
 * one-time download, which the person can start here. Elsewhere it isn't offered.
 */
export const onDeviceUsable = (onDevice: ModelState) =>
  onDevice === "ready" || onDevice === "download";

/**
 * How notes are made: what the host chose (never switched for them, since it decides
 * where the transcript goes), else this computer where Chrome's model can do it, else a
 * key.
 */
export function preferredEngine(
  settings: NotesSettings,
  onDevice: ModelState,
): EngineId {
  if (settings.engine) return settings.engine;
  return onDeviceUsable(onDevice) ? "onDevice" : "ownKey";
}

/**
 * Whether this browser can make notes as the settings say, without a trip to Settings:
 * Chrome's model works here (or downloads when asked), or there's a key.
 */
export function canMakeNotes(
  settings: NotesSettings,
  onDevice: ModelState,
): boolean {
  return preferredEngine(settings, onDevice) === "onDevice"
    ? onDeviceUsable(onDevice)
    : providerChoice(settings).key !== "";
}

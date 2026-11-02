"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { meetingApi } from "@/components/meeting/api-client";
import { useOnDeviceModel } from "@/hooks/use-on-device-model";
import { modelApi } from "@/lib/ai/built-in";
import {
  notesOnDevice,
  notesWithKey,
  preferredEngine,
  providerChoice,
  UnreadableNotesError,
  type NotesProgress,
} from "@/lib/notes/engines";
import { MAX_SAVED_NOTES_BYTES, savedNotesBytes } from "@/lib/notes/notes";
import { ProviderError, type ProviderFailure } from "@/lib/notes/providers";
import { useNotesSettings } from "@/lib/notes/settings";
import {
  loadMadeNotes,
  saveMadeNotes,
  transcriptText,
  type MadeNotes,
  type TranscriptLine,
} from "@/lib/notes/transcript";
import { useIntlLocale } from "@/lib/preferences";

/** Why notes couldn't be made. */
export type NotesFailure =
  | { kind: "unreadable" | "onDevice" | "noKey" }
  | { kind: ProviderFailure; detail: string };

export type MakerState =
  | { step: "ready" }
  | { step: "making"; progress: NotesProgress | null }
  | { step: "done"; made: MadeNotes }
  | { step: "failed"; failure: NotesFailure };

const settled = (sessionId: string): MakerState => {
  const made = loadMadeNotes(sessionId);
  return made ? { step: "done", made } : { step: "ready" };
};

/** Saving the notes to the meeting: where it stands. */
export type SaveState = "idle" | "saving" | "failed";

/**
 * Makes AI notes from this tab's transcript, the way Settings → AI notes says, and keeps
 * them in the tab; making them again replaces them. Saving puts them with the meeting
 * (for Previous), shared with its attendees or not.
 */
export function useNotesMaker({
  code,
  sessionId,
  title,
  lines,
}: {
  code: string;
  sessionId: string;
  title: string;
  lines: readonly TranscriptLine[];
}) {
  const locale = useLocale();
  const timeLocale = useIntlLocale();
  const settings = useNotesSettings();
  const onDevice = useOnDeviceModel();
  const engine = preferredEngine(settings, onDevice ?? "none");
  const choice = providerChoice(settings);
  const [state, setState] = useState<MakerState>(() => settled(sessionId));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  /** The last save left the transcript out: it was too long. */
  const [transcriptLeftOut, setTranscriptLeftOut] = useState(false);
  const running = useRef<AbortController | null>(null);

  // Leaving the page stops a run; nothing is half-saved.
  useEffect(() => () => running.current?.abort(), []);

  /** Whether making notes can start now, without a trip to Settings. */
  const ready =
    engine === "onDevice"
      ? onDevice === "ready" || onDevice === "download"
      : choice.key !== "";

  async function make() {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    if (engine === "ownKey" && !choice.key) {
      setState({ step: "failed", failure: { kind: "noKey" } });
      return;
    }
    setState({ step: "making", progress: null });
    setSaveState("idle");
    const job = {
      locale,
      title,
      transcript: transcriptOf(),
      signal: controller.signal,
      onProgress: (progress: NotesProgress) => {
        if (!controller.signal.aborted) setState({ step: "making", progress });
      },
    };
    try {
      const api = modelApi();
      let notes;
      if (engine === "onDevice") {
        if (!api) throw new Error("Chrome's built-in model isn't here.");
        notes = await notesOnDevice({ ...job, api });
      } else {
        notes = await notesWithKey({ ...job, ...choice });
      }
      if (controller.signal.aborted) return;
      const made: MadeNotes = {
        notes,
        engine,
        ...(engine === "ownKey" ? { provider: choice.provider } : {}),
        madeAt: Date.now(),
      };
      saveMadeNotes(sessionId, made);
      setState({ step: "done", made });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        step: "failed",
        failure:
          error instanceof ProviderError
            ? { kind: error.failure, detail: error.detail }
            : error instanceof UnreadableNotesError
              ? { kind: "unreadable" }
              : engine === "onDevice"
                ? { kind: "onDevice" }
                : { kind: "other", detail: "" },
      });
    }
  }

  function cancel() {
    running.current?.abort();
    setState(settled(sessionId));
  }

  /** Forgets the notes made in this tab. */
  function discard() {
    running.current?.abort();
    saveMadeNotes(sessionId, null);
    setState({ step: "ready" });
  }

  /** The transcript as text, its times on this device's clock. */
  function transcriptOf() {
    const time = new Intl.DateTimeFormat(timeLocale, { timeStyle: "short" });
    return transcriptText(lines, (at) => time.format(at));
  }

  /**
   * Saves the notes to the meeting (shared with its attendees, or not), or changes
   * whether saved notes are shared. A transcript too long to save is left out.
   */
  async function save(shared: boolean) {
    if (state.step !== "done") return;
    const { made } = state;
    setSaveState("saving");
    try {
      if (made.saved) {
        await meetingApi.shareNotes(code, sessionId, shared);
      } else {
        const full = transcriptOf();
        const fits = savedNotesBytes(made.notes, full) <= MAX_SAVED_NOTES_BYTES;
        await meetingApi.saveNotes(code, sessionId, {
          notes: made.notes,
          transcript: fits ? full : null,
          engine: made.engine,
          provider: made.provider ?? null,
          madeAt: new Date(made.madeAt).toISOString(),
          shared,
        });
        setTranscriptLeftOut(!fits);
      }
      const next: MadeNotes = { ...made, saved: { shared } };
      saveMadeNotes(sessionId, next);
      setState({ step: "done", made: next });
      setSaveState("idle");
    } catch {
      setSaveState("failed");
    }
  }

  return {
    state,
    engine,
    onDevice,
    provider: choice.provider,
    ready,
    make,
    cancel,
    discard,
    saveState,
    transcriptLeftOut,
    save,
  };
}

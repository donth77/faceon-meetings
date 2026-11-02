"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";

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

const settled = (code: string): MakerState => {
  const made = loadMadeNotes(code);
  return made ? { step: "done", made } : { step: "ready" };
};

/**
 * Makes AI notes from this tab's transcript, the way Settings → AI notes says, and keeps
 * them in the tab. Making them again replaces them.
 */
export function useNotesMaker({
  code,
  title,
  lines,
}: {
  code: string;
  title: string;
  lines: readonly TranscriptLine[];
}) {
  const locale = useLocale();
  const timeLocale = useIntlLocale();
  const settings = useNotesSettings();
  const onDevice = useOnDeviceModel();
  const engine = preferredEngine(settings, onDevice ?? "none");
  const choice = providerChoice(settings);
  const [state, setState] = useState<MakerState>(() => settled(code));
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
    const time = new Intl.DateTimeFormat(timeLocale, { timeStyle: "short" });
    const job = {
      locale,
      title,
      transcript: transcriptText(lines, (at) => time.format(at)),
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
      saveMadeNotes(code, made);
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
    setState(settled(code));
  }

  /** Forgets the notes made in this tab. */
  function discard() {
    running.current?.abort();
    saveMadeNotes(code, null);
    setState({ step: "ready" });
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
  };
}

"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import { useSpeechLanguage } from "@/hooks/use-speech-language";
import type { NotesState } from "@/lib/media/types";
import {
  MAX_NOTES_LINE,
  type TranscriptionStatus,
} from "@/lib/meetings/events";
import {
  speechApi,
  startTranscribing,
  transcriptionStatus,
  type Transcriber,
} from "@/lib/notes/speech";
import { downloadSpeech, useSpeechSetup } from "@/lib/notes/speech-setup";
import {
  addLine,
  loadTranscript,
  saveTranscript,
  type TranscriptLine,
} from "@/lib/notes/transcript";

import type { RoomMedia } from "../media";

/** A line you said, before the notetaker labels it. */
type OwnLine = { id: string; text: string; lang: string };

/** What your own device does for AI notes while they're on. */
export type SelfTranscription =
  | "off"
  /** Finding out what this device can do. */
  | "checking"
  /** What you say goes into the notes. */
  | "listening"
  /** It will once you unmute. */
  | "muted"
  | "optedOut"
  /** This device can, after a one-time download you start. */
  | "download"
  | "downloading"
  | "unsupported";

/**
 * While AI notes are on, your browser transcribes your own mic on this device and sends
 * each finished line to the notetaker. Only while you're unmuted, and never once you
 * choose Don't transcribe me. Everyone's device says whether they're in the notes.
 */
export function useTranscription({
  media,
  notes,
  onLine,
}: {
  media: Pick<RoomMedia, "mic" | "sendEvent" | "subscribeEvents">;
  notes: NotesState | null;
  /** Your own line, for the transcript when you're the notetaker. */
  onLine: (line: OwnLine) => void;
}) {
  const lang = useSpeechLanguage();
  const on = notes !== null;
  const [optedOut, setOptedOut] = useState(false);
  // What this device can do, shared with pre-join and Settings → AI notes.
  const support = useSpeechSetup(lang);
  const [failed, setFailed] = useState(false);
  const transcriber = useRef<Transcriber | null>(null);
  const { sendEvent } = media;

  const track = media.mic.enabled ? media.mic.track : null;
  const ready = on && !optedOut && support === "available" && !failed;
  const send = useEffectEvent((text: string) => {
    const line: OwnLine = {
      id: crypto.randomUUID(),
      text: text.slice(0, MAX_NOTES_LINE),
      lang,
    };
    onLine(line);
    void sendEvent({ type: "notes.line", ...line }).catch(() => {});
  });
  useEffect(() => {
    const api = speechApi();
    if (!ready || !track || !api) return;
    const started = startTranscribing({
      api,
      lang,
      track,
      onLine: send,
      onFail: () => setFailed(true),
    });
    transcriber.current = started;
    // Muting or AI notes stopping keeps the words already said.
    return () => {
      started.stop("finish");
      if (transcriber.current === started) transcriber.current = null;
    };
  }, [ready, track, lang]);

  // Tell the notetaker whether you're in the notes: when that changes, when AI notes
  // start, and when the notetaker's tab asks (it's started listening, or rejoined).
  const status = on ? transcriptionStatus({ optedOut, support, failed }) : null;
  const startedAt = notes?.startedAt;
  useEffect(() => {
    if (status === null || startedAt === undefined) return;
    void sendEvent({ type: "notes.status", status }).catch(() => {});
  }, [status, startedAt, sendEvent]);
  const sayStatus = useEffectEvent((askedBy: string) => {
    if (status === null || askedBy !== notes?.by) return;
    void sendEvent({ type: "notes.status", status }).catch(() => {});
  });
  const { subscribeEvents } = media;
  useEffect(
    () =>
      subscribeEvents((event, sender) => {
        if (sender && event.type === "notes.statusRequest") {
          sayStatus(sender.userId);
        }
      }),
    [subscribeEvents],
  );

  const state: SelfTranscription = !on
    ? "off"
    : optedOut
      ? "optedOut"
      : support === "checking"
        ? "checking"
        : failed || support === "unavailable"
          ? "unsupported"
          : support === "downloadable"
            ? "download"
            : support === "downloading"
              ? "downloading"
              : track
                ? "listening"
                : "muted";

  /** Don't transcribe me: words not yet sent are dropped too. */
  const optOut = useCallback((value: boolean) => {
    if (value) transcriber.current?.stop("discard");
    setOptedOut(value);
  }, []);
  /** The one-time download; the person asks for it. True once it's ready. */
  const download = useCallback(() => downloadSpeech(lang), [lang]);

  return { state, optedOut, setOptedOut: optOut, download };
}

/**
 * The notetaker's transcript: everyone's lines, labeled with who said them, plus who
 * isn't in the notes and why. It stays in this tab, so a reload keeps it.
 */
export function useTranscript({
  media,
  sessionId,
  collecting,
  self,
}: {
  media: Pick<RoomMedia, "subscribeEvents" | "sendEvent">;
  sessionId: string;
  /** You're the notetaker, and AI notes are on. */
  collecting: boolean;
  self: { id: string; name: string };
}) {
  const [lines, setLines] = useState<readonly TranscriptLine[]>(() =>
    loadTranscript(sessionId),
  );
  const [statuses, setStatuses] = useState<
    Readonly<Record<string, TranscriptionStatus>>
  >({});
  const isCollecting = useEffectEvent(() => collecting);
  const { subscribeEvents, sendEvent } = media;

  // Starting to listen, everyone says again whether they're in the notes: what they said
  // before this tab was listening (before a rejoin, say) never arrived.
  useEffect(() => {
    if (!collecting) return;
    void sendEvent({ type: "notes.statusRequest" }).catch(() => {});
  }, [collecting, sendEvent]);

  useEffect(
    () =>
      subscribeEvents((event, sender) => {
        if (!sender) return;
        // Kept even before this tab knows it's taking the notes: everyone says it as the
        // notetaker (re)joins, which can be before the session's state has arrived.
        if (event.type === "notes.status") {
          setStatuses((all) =>
            all[sender.userId] === event.status
              ? all
              : { ...all, [sender.userId]: event.status },
          );
          return;
        }
        if (event.type === "notes.line" && isCollecting()) {
          setLines((list) =>
            addLine(list, {
              id: event.id,
              speakerId: sender.userId,
              speaker: sender.name,
              text: event.text,
              at: Date.now(),
              lang: event.lang,
            }),
          );
        }
      }),
    [subscribeEvents],
  );

  useEffect(() => saveTranscript(sessionId, lines), [sessionId, lines]);

  return {
    lines,
    statuses,
    /** Your own line, at once; the provider's echo is then a repeat. */
    addOwn(line: OwnLine) {
      if (!collecting) return;
      setLines((list) =>
        addLine(list, {
          ...line,
          speakerId: self.id,
          speaker: self.name,
          at: Date.now(),
        }),
      );
    },
    clear: () => setLines([]),
  };
}

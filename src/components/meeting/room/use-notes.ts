"use client";

import { useLocale } from "next-intl";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import type { NotesState } from "@/lib/media/types";
import {
  MAX_NOTES_LINE,
  type TranscriptionStatus,
} from "@/lib/meetings/events";
import {
  installSpeech,
  speechApi,
  speechLanguage,
  speechSupport,
  startTranscribing,
  type SpeechSupport,
  type Transcriber,
} from "@/lib/notes/speech";
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
  media: Pick<RoomMedia, "mic" | "sendEvent" | "participants">;
  notes: NotesState | null;
  /** Your own line, for the transcript when you're the notetaker. */
  onLine: (line: OwnLine) => void;
}) {
  const locale = useLocale();
  const lang = speechLanguage(locale, navigator.languages);
  const on = notes !== null;
  const [optedOut, setOptedOut] = useState(false);
  const [support, setSupport] = useState<SpeechSupport | "checking">(
    "checking",
  );
  const [failed, setFailed] = useState(false);
  const transcriber = useRef<Transcriber | null>(null);
  const { sendEvent } = media;

  // What this device can do, asked once AI notes are on; while another tab downloads
  // the language, asked again until it's ready.
  useEffect(() => {
    if (!on || (support !== "checking" && support !== "downloading")) return;
    let cancelled = false;
    const check = () =>
      void speechSupport(speechApi(), lang).then((found) => {
        if (!cancelled) setSupport(found);
      });
    if (support === "checking") check();
    const timer =
      support === "downloading" ? setInterval(check, 5000) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [on, support, lang]);

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
  // start, and when the notetaker (re)joins.
  const status: TranscriptionStatus | null = !on
    ? null
    : optedOut
      ? "optedOut"
      : support === "checking"
        ? null
        : support === "available" && !failed
          ? "on"
          : "unsupported";
  const notetakerJoined = Math.max(
    0,
    ...media.participants
      .filter((p) => p.userId === notes?.by)
      .map((p) => p.joinedAt),
  );
  const startedAt = notes?.startedAt;
  useEffect(() => {
    if (status === null || startedAt === undefined) return;
    void sendEvent({ type: "notes.status", status }).catch(() => {});
  }, [status, startedAt, notetakerJoined, sendEvent]);

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
  /** The one-time download; the person asks for it. */
  const download = useCallback(async () => {
    setSupport("downloading");
    const installed = await installSpeech(speechApi(), lang);
    setSupport(
      installed ? "available" : await speechSupport(speechApi(), lang),
    );
  }, [lang]);

  return { state, optedOut, setOptedOut: optOut, download };
}

/**
 * The notetaker's transcript: everyone's lines, labeled with who said them, plus who
 * isn't in the notes and why. It stays in this tab, so a reload keeps it.
 */
export function useTranscript({
  media,
  code,
  collecting,
  self,
}: {
  media: Pick<RoomMedia, "subscribeEvents">;
  code: string;
  /** You're the notetaker, and AI notes are on. */
  collecting: boolean;
  self: { id: string; name: string };
}) {
  const [lines, setLines] = useState<readonly TranscriptLine[]>(() =>
    loadTranscript(code),
  );
  const [statuses, setStatuses] = useState<
    Readonly<Record<string, TranscriptionStatus>>
  >({});
  const isCollecting = useEffectEvent(() => collecting);
  const { subscribeEvents } = media;

  useEffect(
    () =>
      subscribeEvents((event, sender) => {
        if (!sender || !isCollecting()) return;
        if (event.type === "notes.line") {
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
        } else if (event.type === "notes.status") {
          setStatuses((all) =>
            all[sender.userId] === event.status
              ? all
              : { ...all, [sender.userId]: event.status },
          );
        }
      }),
    [subscribeEvents],
  );

  useEffect(() => saveTranscript(code, lines), [code, lines]);

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

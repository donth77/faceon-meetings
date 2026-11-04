"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { focusKeyNext } from "@/components/notes/key-focus";
import { useNotesSentence } from "@/components/notes/notes-here";
import { useOnDeviceModel } from "@/hooks/use-on-device-model";
import { aiNotesEnabled } from "@/lib/env";
import type {
  AdmittedMeetingInfo,
  SelfInfo,
  SessionInfo,
} from "@/lib/meetings/api";
import { notesOnJoin, offersNotes } from "@/lib/meetings/rules";
import { canMakeNotes, engineFor, providerChoice } from "@/lib/notes/engines";
import {
  keyProblem,
  TEST_AFTER_MS,
  useKeyCheck,
  type KeyCheck,
} from "@/lib/notes/key-check";
import { PROVIDER_INFO } from "@/lib/notes/providers";
import { useNotesSettings } from "@/lib/notes/settings";
import { markNotesTurnedOff } from "@/lib/notes/transcript";

import { meetingApi } from "../api-client";
import type { RoomMedia } from "../media";
import type { NotTranscribed } from "./notes-panel";
import { useTranscript, useTranscription } from "./use-notes";

/**
 * AI notes in the room: everyone hears when they go on, and each device transcribes its
 * own person unless they'd rather not. The notetaker's device collects the transcript.
 * In a meeting set to start them automatically, a host or co-host starts them as they
 * join, if their browser can make notes; otherwise they're told why not. The notetaker's
 * AI key is tested as notes start, so a wrong one is said while there's time to fix it.
 */
export function useMeetingNotes({
  media,
  code,
  session,
  self,
  isHost,
  autoNotes: initialAutoNotes,
  meeting,
  onOpenSettings,
}: {
  media: RoomMedia;
  code: string;
  session: SessionInfo;
  self: SelfInfo;
  isHost: boolean;
  /** The meeting's "Start AI notes automatically", as it was when you joined. */
  autoNotes: boolean;
  /** The meeting as you joined it, until the session's state arrives. */
  meeting: Pick<AdmittedMeetingInfo, "shareNotes">;
  /** Opens Settings → AI notes. */
  onOpenSettings: () => void;
}) {
  const t = useTranslations("Meeting");
  const tf = useTranslations("Notes.failed");
  const notes = media.sessionState?.notes ?? null;
  const isNotetaker = notes?.by === self.id;
  /** Hosts and co-hosts run AI notes, where this copy offers them. */
  const canRunNotes = isHost && aiNotesEnabled;
  /** The meeting's host allows AI notes in their meetings (Settings → AI notes). */
  const notesAllowed = media.sessionState?.notesAllowed ?? false;
  const transcript = useTranscript({
    media,
    sessionId: session.id,
    collecting: isNotetaker,
    self,
  });
  const transcription = useTranscription({
    media,
    notes,
    onLine: transcript.addOwn,
  });
  const { setOptedOut } = transcription;
  /** The one-time speech download, asked for from the toast or the chip. */
  async function download() {
    // The toast offering it has done its job; the chip shows the progress.
    toast.dismiss("notes-banner");
    if (!(await transcription.download())) {
      toast.error(t("notes.downloadFailed"));
    }
  }
  /** More → AI notes: only where this meeting has them, or there's something to come back to. */
  const notesOffered = offersNotes({
    runsNotes: canRunNotes,
    allowed: notesAllowed,
    demo: session.demo,
    on: notes !== null,
    transcribed: transcript.lines.length > 0,
  });

  // The meeting's host can change "Start AI notes automatically" from the room.
  const [autoNotes, setAutoNotesState] = useState(initialAutoNotes);
  async function setAutoNotes(on: boolean) {
    setAutoNotesState(on);
    try {
      await meetingApi.notesSettings(code, { autoNotes: on });
    } catch {
      setAutoNotesState(!on);
      toast.error(t("notes.autoFailed"));
    }
  }

  // Joining a meeting that starts AI notes automatically: decided once, as soon as the
  // session's state and whether this browser can make notes are known.
  const settings = useNotesSettings();
  const onDevice = useOnDeviceModel();
  const state = media.sessionState;
  const choice = providerChoice(settings);
  const withKey = engineFor(settings) === "ownKey";
  /** How this browser makes notes, which everyone is told as it turns them on. */
  const madeWith = { provider: withKey ? choice.provider : null };
  const sentence = useNotesSentence();
  /** Settings → AI notes, with focus on the key. */
  function openKey() {
    focusKeyNext();
    onOpenSettings();
  }

  // Whether the meeting shares AI notes with its participants as they're made: the
  // session's state brings it to everyone, live. Its host can change it from the room;
  // the switch shows their choice until the session's state moves on from what it was.
  const sharedLive = state?.shareNotes ?? meeting.shareNotes;
  const [sharePending, setSharePending] = useState<{
    on: boolean;
    was: boolean;
  } | null>(null);
  const shareNotes =
    sharePending && sharedLive === sharePending.was
      ? sharePending.on
      : sharedLive;
  async function setShareNotes(on: boolean) {
    setSharePending({ on, was: sharedLive });
    try {
      await meetingApi.notesSettings(code, { shareNotes: on });
    } catch {
      setSharePending(null);
      toast.error(t("notes.shareFailed"));
    }
  }
  const joined = useRef(false);
  useEffect(() => {
    if (joined.current || !state || onDevice === null) return;
    joined.current = true;
    const action = notesOnJoin({
      runsNotes: canRunNotes,
      autoNotes: initialAutoNotes,
      allowed: state.notesAllowed,
      demo: session.demo,
      stopped: state.notesStopped,
      on: state.notes !== null,
      canMake: canMakeNotes(settings, onDevice),
    });
    if (action === "start") {
      meetingApi
        .notes(code, { on: true, auto: true, madeWith })
        .catch(() => toast.error(t("notes.failed")));
    } else if (action === "cantMake") {
      toast(t("notes.autoDidntStart"), {
        id: "notes-auto",
        duration: 20_000,
        description: sentence.here({ kind: "needsKey" }),
        action: { label: t("notes.addKey"), onClick: openKey },
      });
    }
  }, [
    state,
    onDevice,
    canRunNotes,
    initialAutoNotes,
    session.demo,
    settings,
    code,
    t,
    openKey,
    madeWith,
    sentence,
  ]);

  // The notetaker's key, tested once as AI notes start (Settings may have done it
  // already): a key its provider refuses is said now, while the transcript is still kept,
  // rather than when the notes are made. Nothing's said while it works.
  const problem = keyProblem(
    useKeyCheck(isNotetaker && withKey ? choice : null, TEST_AFTER_MS),
  );
  const providerName = PROVIDER_INFO[choice.provider].name;
  const toldProblem = useRef<KeyCheck | null>(null);
  useEffect(() => {
    if (problem === toldProblem.current) return;
    toldProblem.current = problem;
    if (!problem) {
      toast.dismiss("notes-key");
      return;
    }
    toast.error(tf(problem.failure, { provider: providerName }), {
      id: "notes-key",
      duration: 20_000,
      description: t("notes.keyProblem"),
      action: { label: t("notes.fixKey"), onClick: openKey },
    });
  }, [problem, providerName, tf, t, openKey]);

  // Said up front, so everyone knows where the notes go before they speak.
  const shared = shareNotes;
  // One toast as AI notes go on, once this browser knows whether it can transcribe you:
  // who turned them on and Don't transcribe me; or, where the one-time download is
  // needed, that, with Download (the chip keeps it until it's done).
  const announced = useRef<string | null>(null);
  const selfState = transcription.state;
  useEffect(() => {
    const key = notes ? `${notes.by}@${notes.startedAt}` : null;
    if (key === announced.current) return;
    if (notes && selfState === "checking") return;
    const wasOn = announced.current !== null;
    announced.current = key;
    if (!notes) {
      if (wasOn) toast(t("notes.stopped"), { id: "notes-banner" });
      return;
    }
    const yours = notes.by === self.id;
    // Where everyone's words go: the notetaker's provider, or their computer.
    const where = notes.madeWith
      ? sentence.madeWith(notes.madeWith, notes.name)
      : undefined;
    if (selfState === "download") {
      toast(
        yours
          ? t("notes.downloadOffer")
          : t(shared ? "notes.bannerDownloadShared" : "notes.bannerDownload", {
              name: notes.name,
            }),
        {
          id: "notes-banner",
          duration: 20_000,
          description: yours ? undefined : where,
          action: {
            label: t("notes.downloadNow"),
            onClick: () => void download(),
          },
        },
      );
      return;
    }
    if (yours) return;
    if (selfState === "unsupported") {
      toast(
        t(
          shared ? "notes.bannerUnsupportedShared" : "notes.bannerUnsupported",
          { name: notes.name },
        ),
        {
          id: "notes-banner",
          duration: 15_000,
          description: where,
        },
      );
      return;
    }
    toast(
      t(shared ? "notes.bannerShared" : "notes.banner", { name: notes.name }),
      {
        id: "notes-banner",
        duration: 15_000,
        description: where,
        action: {
          label: t("notes.dontTranscribe"),
          onClick: () => setOptedOut(true),
        },
      },
    );
  }, [notes, selfState, self.id, t, setOptedOut, download, shared, sentence]);

  // The meeting's host turned AI notes off: what this tab collected becomes notes only
  // when asked, here or after the meeting.
  const allowedNow = media.sessionState?.notesAllowed;
  const collected = transcript.lines.length > 0;
  useEffect(() => {
    if (allowedNow === undefined || !collected) return;
    markNotesTurnedOff(session.id, !allowedNow);
  }, [allowedNow, collected, session.id]);

  // Who isn't in the notes, for the notetaker; you see your own state in the chip.
  const notTranscribed: NotTranscribed[] = [];
  for (const person of media.participants) {
    const status = transcript.statuses[person.userId];
    if (
      person.userId === self.id ||
      notTranscribed.some((p) => p.userId === person.userId) ||
      status === undefined ||
      status === "on"
    ) {
      continue;
    }
    notTranscribed.push({
      userId: person.userId,
      name: person.name,
      reason: status,
    });
  }

  async function setNotesOn(on: boolean) {
    try {
      await meetingApi.notes(code, on ? { on, madeWith } : { on });
    } catch {
      toast.error(t("notes.failed"));
    }
  }

  return {
    notes,
    isNotetaker,
    canRunNotes,
    notesAllowed,
    notesOffered,
    /** This browser can make the notes from the transcript; true until that's known. */
    canMake: onDevice === null || canMakeNotes(settings, onDevice),
    /** The notetaker's key, refused by its provider as AI notes started. */
    keyProblem: problem
      ? { failure: problem.failure, provider: choice.provider }
      : null,
    openKey,
    autoNotes,
    shareNotes,
    setShareNotes,
    setAutoNotes,
    transcript,
    transcription,
    notTranscribed,
    setNotesOn,
    downloadSpeech: download,
  };
}

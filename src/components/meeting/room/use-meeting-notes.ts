"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useOnDeviceModel } from "@/hooks/use-on-device-model";
import { aiNotesEnabled } from "@/lib/env";
import type {
  AdmittedMeetingInfo,
  SelfInfo,
  SessionInfo,
} from "@/lib/meetings/api";
import { notesOnJoin, offersNotes } from "@/lib/meetings/rules";
import { canMakeNotes } from "@/lib/notes/engines";
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
 * join, if their browser can make notes; otherwise they're told why not.
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
        .notes(code, { on: true, auto: true })
        .catch(() => toast.error(t("notes.failed")));
    } else if (action === "cantMake") {
      toast(t("notes.autoCantMake"), {
        id: "notes-auto",
        duration: 20_000,
        action: { label: t("notes.autoSettings"), onClick: onOpenSettings },
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
    onOpenSettings,
  ]);

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
    if (selfState === "download") {
      toast(
        yours
          ? t("notes.downloadOffer")
          : t("notes.bannerDownload", { name: notes.name }),
        {
          id: "notes-banner",
          duration: 20_000,
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
      toast(t("notes.bannerUnsupported", { name: notes.name }), {
        id: "notes-banner",
        duration: 15_000,
      });
      return;
    }
    toast(
      t(shared ? "notes.bannerShared" : "notes.banner", { name: notes.name }),
      {
        id: "notes-banner",
        duration: 15_000,
        action: {
          label: t("notes.dontTranscribe"),
          onClick: () => setOptedOut(true),
        },
      },
    );
  }, [notes, selfState, self.id, t, setOptedOut, download, shared]);

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
      await meetingApi.notes(code, { on });
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

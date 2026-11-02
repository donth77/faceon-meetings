"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { aiNotesEnabled } from "@/lib/env";
import type { SelfInfo, SessionInfo } from "@/lib/meetings/api";

import { meetingApi } from "../api-client";
import type { RoomMedia } from "../media";
import type { NotTranscribed } from "./notes-panel";
import { useTranscript, useTranscription } from "./use-notes";

/**
 * AI notes in the room: everyone hears when they go on, and each device transcribes its
 * own person unless they'd rather not. The notetaker's device collects the transcript.
 */
export function useMeetingNotes({
  media,
  code,
  session,
  self,
  isHost,
}: {
  media: RoomMedia;
  code: string;
  session: SessionInfo;
  self: SelfInfo;
  isHost: boolean;
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
  const { setOptedOut, download } = transcription;

  const announced = useRef<string | null>(null);
  useEffect(() => {
    const key = notes ? `${notes.by}@${notes.startedAt}` : null;
    if (key === announced.current) return;
    const wasOn = announced.current !== null;
    announced.current = key;
    if (!notes) {
      if (wasOn) toast(t("notes.stopped"), { id: "notes-banner" });
      return;
    }
    if (notes.by === self.id) return;
    toast(t("notes.banner", { name: notes.name }), {
      id: "notes-banner",
      duration: 15_000,
      action: {
        label: t("notes.dontTranscribe"),
        onClick: () => setOptedOut(true),
      },
    });
  }, [notes, self.id, t, setOptedOut]);

  // Where this browser needs its one-time speech download, offer it once.
  const offeredDownload = useRef(false);
  useEffect(() => {
    if (transcription.state !== "download" || offeredDownload.current) return;
    offeredDownload.current = true;
    toast(t("notes.downloadOffer"), {
      id: "notes-download",
      duration: 20_000,
      action: { label: t("notes.download"), onClick: () => void download() },
    });
  }, [transcription.state, t, download]);

  // Who isn't in the notes, for the notetaker; you see your own state in the chip.
  const notTranscribed: NotTranscribed[] = [];
  for (const person of media.participants) {
    const status = transcript.statuses[person.userId];
    if (
      person.userId === self.id ||
      notTranscribed.some((p) => p.userId === person.userId) ||
      (status !== "optedOut" && status !== "unsupported")
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
    transcript,
    transcription,
    notTranscribed,
    setNotesOn,
  };
}

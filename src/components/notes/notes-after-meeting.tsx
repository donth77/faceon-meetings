"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  loadTranscript,
  notesTurnedOff,
  saveTranscript,
} from "@/lib/notes/transcript";

import { NotesMaker } from "./notes-maker";

/**
 * After the meeting, for whoever took AI notes in this tab: the notes, made from the
 * transcript (at once where nothing needs asking, unless the meeting's host turned AI
 * notes off), with Copy and Download.
 */
export function NotesAfterMeeting({
  code,
  title,
  session,
}: {
  code: string;
  title: string;
  /**
   * The session you left, whether you're signed in to save notes with it, and whether
   * the meeting shares them with its participants.
   */
  session: { id: string; signedIn: boolean; shareNotes: boolean };
}) {
  const t = useTranslations("Notes");
  const [lines, setLines] = useState(() => loadTranscript(session.id));
  const [askFirst] = useState(() => notesTurnedOff(session.id));
  if (lines.length === 0) return null;
  return (
    <section
      aria-labelledby="notes-after-meeting"
      className="bg-card ring-border flex w-full max-w-[720px] flex-col gap-5 rounded-[20px] p-6 text-left ring-1 sm:p-8"
    >
      <h2
        id="notes-after-meeting"
        className="flex items-center gap-2 text-xl font-bold"
      >
        <Sparkles className="text-primary size-5" aria-hidden="true" />
        {t("title")}
      </h2>
      <NotesMaker
        code={code}
        sessionId={session.id}
        canSave={session.signedIn}
        title={title}
        lines={lines}
        settings={{ href: "/settings/ai-notes" }}
        autoStart={!askFirst}
        autoShare={session.shareNotes}
        onDiscard={() => {
          saveTranscript(session.id, []);
          setLines([]);
        }}
      />
    </section>
  );
}

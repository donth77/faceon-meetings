"use client";

import { useTranslations } from "next-intl";

import type { NotesMadeWith } from "@/lib/meetings/api";
import type { NotesHere } from "@/lib/notes/engines";
import { PROVIDER_INFO } from "@/lib/notes/providers";

/**
 * The one sentence on what happens to AI notes: in this browser (Settings → AI notes), or,
 * for everyone in a meeting, in the notetaker's (the "AI notes on" notice), so people
 * know where their words go.
 */
export function useNotesSentence() {
  const t = useTranslations("Notes");
  return {
    here(here: NotesHere): string {
      if (here.kind !== "key") return t(`here.${here.kind}`);
      const provider = PROVIDER_INFO[here.provider].name;
      return t(here.transcribes ? "here.transcribes" : "here.writes", {
        provider,
      });
    },
    madeWith(madeWith: NotesMadeWith, name: string): string {
      if (madeWith.transcriptOnly) return t("made.transcriptOnly", { name });
      if (!madeWith.provider) return t("made.onDevice", { name });
      const info = PROVIDER_INFO[madeWith.provider];
      return t(info.transcribes ? "here.transcribes" : "here.writes", {
        provider: info.name,
      });
    },
  };
}

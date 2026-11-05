"use client";

import { Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { downloadFile } from "@/lib/download";
import {
  notesMarkdown,
  transcriptMarkdown,
  type MeetingNotes,
} from "@/lib/notes/notes";

export const NOTES_ACTION =
  "h-10 gap-2 rounded-[10px] px-3.5 text-sm font-semibold";

/** The notes as Markdown, with headings in the reader's language. */
export function useNotesMarkdown() {
  const t = useTranslations("Notes");
  return (input: {
    title: string;
    when: string;
    notes: MeetingNotes;
    transcript: string;
  }) =>
    notesMarkdown({
      ...input,
      labels: {
        summary: t("summary"),
        actionItems: t("actionItems"),
        decisions: t("decisions"),
        transcript: t("transcript"),
        noOwner: t("noOwner"),
        due: (when) => t("dueBy", { when }),
        none: t("none"),
      },
    });
}

/** The transcript alone as Markdown, for a meeting kept as a transcript only. */
export function useTranscriptMarkdown() {
  const t = useTranslations("Notes");
  return (input: { title: string; when: string; transcript: string }) =>
    transcriptMarkdown({ ...input, heading: t("transcript") });
}

/**
 * Copy and Download .md, for notes in the meeting, after it, and on their page, or for
 * a transcript only (`transcript`, which names the file for it).
 */
export function NotesFileButtons({
  title,
  markdown,
  transcript = false,
}: {
  /** Names the downloaded file. */
  title: string;
  /** The notes (or the transcript) as Markdown, made when asked for. */
  markdown: () => string;
  transcript?: boolean;
}) {
  const t = useTranslations("Notes");

  const copy = () =>
    copyText(markdown(), { copied: t("copied"), failed: t("copyFailed") });

  return (
    <>
      <Button
        variant="outline"
        className={NOTES_ACTION}
        onPress={() => void copy()}
      >
        <Copy className="size-4" aria-hidden="true" />
        {t("copy")}
      </Button>
      <Button
        variant="outline"
        className={NOTES_ACTION}
        onPress={() =>
          downloadFile({
            name: t(transcript ? "transcriptFileName" : "fileName", { title }),
            extension: "md",
            content: markdown(),
            type: "text/markdown",
          })
        }
      >
        <Download className="size-4" aria-hidden="true" />
        {t("download")}
      </Button>
    </>
  );
}

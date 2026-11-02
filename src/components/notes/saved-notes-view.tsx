"use client";

import { ChevronLeft, Lock, Sparkles, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { meetingApi } from "@/components/meeting/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import type { SavedNotes } from "@/lib/meetings/saved-notes";
import { PROVIDER_INFO } from "@/lib/notes/providers";
import { useIntlLocale } from "@/lib/preferences";
import { formatDay } from "@/lib/time";

import { NOTES_ACTION, NotesFileButtons, useNotesMarkdown } from "./notes-file";
import { NOTES_CARD, NotesView } from "./notes-view";

/** Transcript turns shown before "Show all". */
const FIRST_TURNS = 8;

/** One turn of the saved transcript: "Ana (10:02): …". */
function parseTurn(paragraph: string) {
  const match = /^(.+?) \(([^)]*)\): ([\s\S]*)$/.exec(paragraph);
  return match
    ? { speaker: match[1] ?? "", time: match[2] ?? "", text: match[3] ?? "" }
    : { speaker: "", time: "", text: paragraph };
}

/** The saved transcript, its first turns until "Show all". */
function SavedTranscript({ transcript }: { transcript: string }) {
  const t = useTranslations("SavedNotes");
  const tn = useTranslations("Notes");
  const [all, setAll] = useState(false);
  const turns = transcript
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(parseTurn);
  const shown = all ? turns : turns.slice(0, FIRST_TURNS);
  return (
    <section className={`${NOTES_CARD} col-span-full`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{tn("transcript")}</h2>
        {turns.length > FIRST_TURNS ? (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-semibold"
            onPress={() => setAll((now) => !now)}
          >
            {all ? t("showLess") : t("showAll", { count: turns.length })}
          </Button>
        ) : null}
      </div>
      <ol className="flex flex-col gap-3">
        {shown.map((turn, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="text-muted-foreground w-16 shrink-0 pt-0.5 font-mono text-xs tabular-nums">
              {turn.time}
            </span>
            <p className="min-w-0 text-[15px] leading-normal">
              {turn.speaker ? (
                <strong className="font-semibold">{turn.speaker} </strong>
              ) : null}
              {turn.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Saved AI notes, as in the mockup: the meeting, when it was and who came, Copy and
 * Download, and for whoever saved them or the host, Share and Delete.
 */
export function SavedNotesView({ notes }: { notes: SavedNotes }) {
  const t = useTranslations("SavedNotes");
  const tn = useTranslations("Notes");
  const tp = useTranslations("Previous");
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const router = useRouter();
  const toMarkdown = useNotesMarkdown();
  const [shared, setShared] = useState(notes.shared);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const title = notes.title ?? tp("untitled", { name: notes.hostName });
  const start = new Date(notes.start);
  const end = new Date(notes.end);
  const day = formatDay(start, locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
  const range = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).formatRange(start, end);
  const made = notes.provider
    ? t("madeBy", { provider: PROVIDER_INFO[notes.provider].name })
    : t("madeOnDevice");
  const when = `${day} · ${range}`;

  async function share(next: boolean) {
    setBusy(true);
    try {
      await meetingApi.shareNotes(notes.code, notes.sessionId, next);
      setShared(next);
      toast.success(next ? t("nowShared") : t("noLongerShared"));
    } catch {
      toast.error(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await meetingApi.deleteNotes(notes.code, notes.sessionId);
      toast.success(t("deleted"));
      router.push("/previous");
    } catch {
      toast.error(t("failed"));
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-[940px] flex-col gap-[22px] self-center">
      <div className="flex flex-col gap-2.5">
        <Link
          href="/previous"
          className="text-primary focus-visible:focus-ring flex items-center gap-1 self-start rounded-md text-sm font-semibold outline-hidden hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] text-[#5b4db3] uppercase dark:text-[#cfc8ff]">
              <Sparkles className="size-4" aria-hidden="true" />
              {tn("title")}
            </span>
            <h1 className="text-[34px] leading-tight font-bold tracking-[-0.01em] text-balance">
              {title}
            </h1>
            <p className="text-muted-foreground text-[15px]">
              {[when, tp("people", { count: notes.people }), made].join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NotesFileButtons
              title={title}
              markdown={() =>
                toMarkdown({
                  title,
                  when,
                  notes: notes.notes,
                  transcript: notes.transcript ?? "",
                })
              }
            />
            {notes.canManage ? (
              <Button
                variant={shared ? "outline" : "default"}
                className={NOTES_ACTION}
                isPending={busy}
                onPress={() => void share(!shared)}
              >
                <Users className="size-4" aria-hidden="true" />
                {shared ? tn("stopSharing") : tn("share")}
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-muted-foreground flex items-start gap-2 text-sm leading-normal">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {!notes.canManage
            ? t("sharedWithYou")
            : shared
              ? t("shared")
              : t("private")}
        </p>
      </div>

      <NotesView notes={notes.notes} layout="cards" />
      {notes.transcript ? (
        <div className="grid">
          <SavedTranscript transcript={notes.transcript} />
        </div>
      ) : null}

      {notes.canManage ? (
        <Button
          variant="ghost"
          className={`${NOTES_ACTION} text-muted-foreground self-start`}
          onPress={() => setConfirming(true)}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t("delete")}
        </Button>
      ) : null}
      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={t("deleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={tn("cancel")}
        destructive
        isPending={busy}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

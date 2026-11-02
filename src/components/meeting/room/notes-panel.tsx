"use client";

import { Download, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { Button, Dialog } from "react-aria-components";

import { SwitchRow } from "@/components/schedule/fields";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import type { NotesState } from "@/lib/media/types";
import { turnsOf, type TranscriptLine } from "@/lib/notes/transcript";
import { useIntlLocale } from "@/lib/preferences";

import { SidePanel } from "./side-panel";
import type { SelfTranscription } from "./use-notes";

const POPOVER_BUTTON =
  "focus-visible:ring-ring flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm font-semibold outline-none hover:bg-white/15 focus-visible:ring-2";
const FOOTER_BUTTON =
  "focus-visible:ring-ring flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold outline-none focus-visible:ring-2 disabled:opacity-60";

/** Someone whose words aren't in the notes, and why. */
export type NotTranscribed = {
  userId: string;
  name: string;
  reason: "optedOut" | "unsupported";
};

/** What's been said so far, newest at the bottom; it follows along unless you scroll up. */
function Transcript({ lines }: { lines: readonly TranscriptLine[] }) {
  const t = useTranslations("Meeting.notes");
  const locale = useIntlLocale();
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const following = useRef(true);
  const listRef = useCallback(
    (node: HTMLOListElement | null) => {
      if (node && lines.length > 0 && following.current) {
        node.scrollTop = node.scrollHeight;
      }
    },
    [lines.length],
  );
  const turns = turnsOf(lines);

  if (turns.length === 0) {
    return (
      <p className="text-muted-foreground px-5 text-sm">
        {t("transcriptEmpty")}
      </p>
    );
  }
  return (
    <ol
      ref={listRef}
      aria-label={t("transcript")}
      onScroll={(event) => {
        const node = event.currentTarget;
        following.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 24;
      }}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3"
    >
      {turns.map((turn) => (
        <li key={turn.key} className="text-sm leading-normal">
          <p className="flex items-baseline gap-2">
            <span className="font-semibold">{turn.speaker}</span>
            <time
              dateTime={new Date(turn.at).toISOString()}
              className="text-muted-foreground text-xs"
            >
              {time.format(turn.at)}
            </time>
          </p>
          <p className="text-foreground/90">{turn.text}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * AI notes, for the hosts and co-hosts who run them: what they do, then Start or Stop
 * for everyone. The notetaker (whoever started them) sees the transcript as it grows,
 * and who isn't in it.
 */
export function NotesPanel({
  notes,
  demo,
  isNotetaker,
  lines,
  notTranscribed,
  onChange,
  onClose,
}: {
  notes: NotesState | null;
  /** Demo meetings don't offer AI notes. */
  demo: boolean;
  /** You started them, so the transcript is in your browser. */
  isNotetaker: boolean;
  lines: readonly TranscriptLine[];
  notTranscribed: readonly NotTranscribed[];
  /** Turns AI notes on or off, for everyone. */
  onChange: (on: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.notes");
  const [busy, setBusy] = useState(false);

  async function change(on: boolean) {
    setBusy(true);
    try {
      await onChange(on);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SidePanel
      title={t("title")}
      closeLabel={t("close")}
      onClose={onClose}
      footer={
        notes ? (
          <Button
            isDisabled={busy}
            onPress={() => void change(false)}
            className={`${FOOTER_BUTTON} bg-white/10 hover:bg-white/15`}
          >
            {t("stop")}
          </Button>
        ) : demo ? null : (
          <Button
            isDisabled={busy}
            onPress={() => void change(true)}
            className={`${FOOTER_BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`}
          >
            <Sparkles className="size-[18px]" aria-hidden="true" />
            {t("start")}
          </Button>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 pb-1 text-sm leading-normal">
        {notes ? (
          <p className="px-5">
            {isNotetaker
              ? t("youTakeNotes")
              : t("takingNotes", { name: notes.name })}
          </p>
        ) : (
          <div className="flex flex-col gap-3 px-5">
            <p>{t("intro")}</p>
            <p className="text-muted-foreground">
              {demo ? t("notInDemo") : t("everyoneSees")}
            </p>
          </div>
        )}
        {notes && isNotetaker && notTranscribed.length > 0 ? (
          <ul
            aria-label={t("notTranscribed")}
            className="text-muted-foreground mx-5 flex flex-col gap-1 rounded-[10px] bg-white/5 px-3 py-2.5 text-[13px]"
          >
            {notTranscribed.map((person) => (
              <li key={person.userId}>
                {person.reason === "optedOut"
                  ? t("personOptedOut", { name: person.name })
                  : t("personUnsupported", { name: person.name })}
              </li>
            ))}
          </ul>
        ) : null}
        {(notes && isNotetaker) || lines.length > 0 ? (
          <Transcript lines={lines} />
        ) : null}
      </div>
    </SidePanel>
  );
}

/**
 * "AI notes on", in the top bar for everyone while they're on: who turned them on,
 * whether what you say goes into them, and Don't transcribe me. Hosts and co-hosts can
 * open the notes from it.
 */
export function NotesChip({
  notes,
  self,
  onOptOutChange,
  onDownload,
  onOpenNotes,
}: {
  notes: NotesState;
  /** What your own device does for the notes. */
  self: SelfTranscription;
  onOptOutChange: (optedOut: boolean) => void;
  /** The one-time download that lets this browser transcribe on the device. */
  onDownload: () => void;
  /** For hosts and co-hosts. */
  onOpenNotes?: (() => void) | undefined;
}) {
  const t = useTranslations("Meeting.notes");
  return (
    <PopoverTrigger>
      <Button
        aria-label={t("chip")}
        className="bg-primary/25 hover:bg-primary/35 focus-visible:ring-ring flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-semibold outline-none focus-visible:ring-2"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        <span className="max-sm:hidden">{t("chip")}</span>
      </Button>
      <Popover placement="bottom end" className="w-80">
        <Dialog
          aria-label={t("title")}
          className="flex flex-col gap-2 p-1.5 outline-none"
        >
          {({ close }) => (
            <>
              <p className="text-sm leading-normal">
                {t("banner", { name: notes.name })}
              </p>
              {self === "off" || self === "checking" ? null : (
                <p role="status" className="text-muted-foreground text-[13px]">
                  {t(`self.${self}`)}
                </p>
              )}
              {self === "download" ? (
                <Button onPress={onDownload} className={POPOVER_BUTTON}>
                  <Download className="size-4" aria-hidden="true" />
                  {t("download")}
                </Button>
              ) : null}
              <SwitchRow
                label={t("dontTranscribe")}
                help={t("dontTranscribeHelp")}
                isSelected={self === "optedOut"}
                onChange={onOptOutChange}
              />
              {onOpenNotes ? (
                <Button
                  onPress={() => {
                    close();
                    onOpenNotes();
                  }}
                  className={POPOVER_BUTTON}
                >
                  {t("open")}
                </Button>
              ) : null}
            </>
          )}
        </Dialog>
      </Popover>
    </PopoverTrigger>
  );
}

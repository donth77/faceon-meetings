"use client";

import {
  Download,
  KeyRound,
  LoaderCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Dialog } from "react-aria-components";

import { EnglishNotesNotice } from "@/components/notes/english-notes-notice";
import { useNotesSentence } from "@/components/notes/notes-here";
import { NotesMaker } from "@/components/notes/notes-maker";
import { Button as UiButton } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/form-fields";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useOnDeviceNotesInEnglish } from "@/hooks/use-on-device-model";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { dismiss, useDismissed } from "@/lib/dismissals";
import type { NotesState } from "@/lib/media/types";
import type { TranscriptionStatus } from "@/lib/meetings/events";
import { notesPanelButton } from "@/lib/meetings/rules";
import { engineFor } from "@/lib/notes/engines";
import {
  PROVIDER_INFO,
  type ProviderFailure,
  type ProviderId,
} from "@/lib/notes/providers";
import { useNotesSettings } from "@/lib/notes/settings";
import { turnsOf, type TranscriptLine } from "@/lib/notes/transcript";
import { useIntlLocale } from "@/lib/preferences";

import { SidePanel } from "./side-panel";
import type { SelfTranscription } from "./use-notes";

const POPOVER_BUTTON =
  "flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm font-semibold outline-hidden hover:bg-white/15 focus-visible:focus-ring";
const FOOTER_BUTTON =
  "flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold outline-hidden disabled:opacity-60 focus-visible:focus-ring";

/** Someone whose words aren't in the notes, and why. */
export type NotTranscribed = {
  userId: string;
  name: string;
  reason: Exclude<TranscriptionStatus, "on">;
};

const NOT_TRANSCRIBED = {
  optedOut: "personOptedOut",
  download: "personDownload",
  downloading: "personDownloading",
  unsupported: "personUnsupported",
} as const satisfies Record<NotTranscribed["reason"], string>;

/**
 * What's been said so far, newest at the bottom. While AI notes are on it scrolls by
 * itself and follows along, unless you scroll up.
 */
function Transcript({
  lines,
  follow,
}: {
  lines: readonly TranscriptLine[];
  follow: boolean;
}) {
  const t = useTranslations("Meeting.notes");
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone,
  });
  const following = useRef(true);
  const listRef = useCallback(
    (node: HTMLOListElement | null) => {
      if (node && follow && lines.length > 0 && following.current) {
        node.scrollTop = node.scrollHeight;
      }
    },
    [follow, lines.length],
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
      className={
        follow
          ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3"
          : "flex flex-col gap-3"
      }
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
 * and who isn't in it; once they stop, the notes are made from it here. Where the
 * meeting's host doesn't allow AI notes, it says so, and the host gets a way to Settings.
 * Where this browser can't make notes, Start shows disabled, with why and a way to
 * Settings → AI notes, where a key makes it work.
 */
export function NotesPanel({
  code,
  sessionId,
  canSave,
  title,
  notes,
  demo,
  allowed,
  shared,
  isOwner,
  hostName,
  isNotetaker,
  canMake,
  keyProblem,
  lines,
  notTranscribed,
  onChange,
  onOpenSettings,
  onOpenKey,
  onDiscard,
  onClose,
}: {
  code: string;
  /** This session, which saved notes belong to. */
  sessionId: string;
  /** Signed in: the notes can be saved with the meeting. */
  canSave: boolean;
  /** The meeting's title, which the notes and their file are named after. */
  title: string;
  notes: NotesState | null;
  /** Demo meetings don't offer AI notes. */
  demo: boolean;
  /** The meeting's host allows AI notes in their meetings (Settings → AI notes). */
  allowed: boolean;
  /** The meeting shares AI notes with its participants as soon as they're made. */
  shared: boolean;
  /** You host this meeting, so the choice is yours. */
  isOwner: boolean;
  hostName: string;
  /** You started them, so the transcript is in your browser. */
  isNotetaker: boolean;
  /** This browser can make the notes (Chrome's model, or a key); else Start shows disabled, with why. */
  canMake: boolean;
  /** Your key, refused by its provider as AI notes started: said while there's time to fix it. */
  keyProblem: { failure: ProviderFailure; provider: ProviderId } | null;
  /** This tab's transcript. */
  lines: readonly TranscriptLine[];
  notTranscribed: readonly NotTranscribed[];
  /** Turns AI notes on or off, for everyone. */
  onChange: (on: boolean) => Promise<void>;
  /** Opens Settings → AI notes: making notes, and the host's switch. */
  onOpenSettings: () => void;
  /** Opens Settings → AI notes, with focus on the key. */
  onOpenKey: () => void;
  /** Deletes this tab's transcript and notes. */
  onDiscard: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Meeting.notes");
  const tn = useTranslations("Notes");
  const [busy, setBusy] = useState(false);
  // Notes made on this computer, in a language Chrome's AI doesn't write yet: said once
  // they're on, until put away on this device.
  const settings = useNotesSettings();
  const inEnglish = useOnDeviceNotesInEnglish();
  const englishSeen = useDismissed("notesInEnglish", { hiddenOnServer: true });
  const englishNotice =
    isNotetaker &&
    inEnglish &&
    !englishSeen &&
    engineFor(settings) === "onDevice";
  const bodyRef = useRef<HTMLDivElement>(null);
  const reasonId = useId();

  async function change(on: boolean) {
    setBusy(true);
    try {
      await onChange(on);
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (notes) {
    body = (
      <div
        ref={bodyRef}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col gap-3 pb-1 text-sm leading-normal outline-hidden"
      >
        {englishNotice ? (
          <div className="px-5">
            <EnglishNotesNotice
              announce
              actions={[
                { label: tn("settings"), onPress: onOpenSettings },
                {
                  label: t("gotIt"),
                  onPress: () => {
                    // The notice goes, so focus moves to the panel first.
                    bodyRef.current?.focus();
                    dismiss("notesInEnglish");
                  },
                },
              ]}
            />
          </div>
        ) : null}
        {isNotetaker && keyProblem ? (
          <div className="px-5">
            <div
              role="note"
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"
            >
              <KeyRound className="size-5 shrink-0" aria-hidden="true" />
              <p className="min-w-[min(100%,15rem)] flex-1 leading-normal">
                {tn(`failed.${keyProblem.failure}`, {
                  provider: PROVIDER_INFO[keyProblem.provider].name,
                })}{" "}
                {t("keyProblem")}
              </p>
              <UiButton
                variant="outline"
                size="sm"
                className="border-amber-950/30 bg-transparent hover:bg-amber-950/5 dark:border-amber-100/30 dark:hover:bg-amber-100/10"
                onPress={onOpenKey}
              >
                {t("fixKey")}
              </UiButton>
            </div>
          </div>
        ) : null}
        <p className="px-5">
          {isNotetaker
            ? t("youTakeNotes")
            : t("takingNotes", { name: notes.name })}
        </p>
        {shared ? (
          <p className="text-muted-foreground px-5 text-[13px]">
            {t("willBeShared")}
          </p>
        ) : null}
        {isNotetaker && notTranscribed.length > 0 ? (
          <ul
            aria-label={t("notTranscribed")}
            className="text-muted-foreground mx-5 flex flex-col gap-1 rounded-[10px] bg-white/5 px-3 py-2.5 text-[13px]"
          >
            {notTranscribed.map((person) => (
              <li key={person.userId}>
                {t(NOT_TRANSCRIBED[person.reason], { name: person.name })}
              </li>
            ))}
          </ul>
        ) : null}
        {isNotetaker ? <Transcript lines={lines} follow /> : null}
      </div>
    );
  } else if (lines.length > 0) {
    // Stopped: the notes, made from this tab's transcript, then the transcript itself.
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-4">
        <NotesMaker
          code={code}
          sessionId={sessionId}
          canSave={canSave}
          title={title}
          lines={lines}
          settings={{ onPress: onOpenSettings }}
          autoStart={
            // Turned off by the meeting's host, rather than stopped: only when asked.
            allowed
          }
          autoShare={shared}
          onDiscard={onDiscard}
        />
        <section className="flex flex-col gap-3 border-t border-white/10 pt-4">
          <h3 className="text-[15px] font-bold">{tn("transcript")}</h3>
          <Transcript lines={lines} follow={false} />
        </section>
      </div>
    );
  } else {
    let note = shared ? t("everyoneSeesShared") : t("everyoneSees");
    if (demo) note = t("notInDemo");
    else if (!allowed) {
      note = isOwner ? t("offForYou") : t("offByHost", { name: hostName });
    }
    body = (
      <div className="flex flex-col gap-3 px-5 pb-1 text-sm leading-normal">
        <p>{t("intro")}</p>
        <p className="text-muted-foreground">{note}</p>
      </div>
    );
  }

  // One button at the foot, whichever it is, so focus stays put as it changes.
  const button = notesPanelButton({
    on: notes !== null,
    demo,
    allowed,
    isOwner,
    canMake,
  });
  const startLabel = lines.length > 0 ? t("startAgain") : t("start");
  let footer = null;
  if (button === "stop") {
    footer = (
      <Button
        isPending={busy}
        onPress={() => void change(false)}
        className={`${FOOTER_BUTTON} bg-white/10 hover:bg-white/15`}
      >
        {t("stop")}
      </Button>
    );
  } else if (button === "start") {
    footer = (
      <Button
        isPending={busy}
        onPress={() => void change(true)}
        className={`${FOOTER_BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`}
      >
        <Sparkles className="size-[18px]" aria-hidden="true" />
        {startLabel}
      </Button>
    );
  } else if (button === "cantMake") {
    footer = (
      <div className="flex flex-1 flex-col gap-2.5">
        <p
          id={reasonId}
          className="text-muted-foreground text-[13px] leading-normal"
        >
          {t.rich("cantMakeYet", {
            settings: (chunks) => (
              <Button
                onPress={onOpenKey}
                className="text-foreground focus-visible:focus-ring rounded-sm font-semibold underline underline-offset-2 outline-hidden"
              >
                {chunks}
              </Button>
            ),
          })}
        </p>
        <TooltipTrigger>
          {/* Disabled, but still focusable (aria-disabled, not disabled), so the reason
              shows as its tooltip on keyboard focus as well as on hover. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={reasonId}
            className={`${FOOTER_BUTTON} bg-primary text-primary-foreground cursor-not-allowed opacity-60`}
          >
            <Sparkles className="size-[18px]" aria-hidden="true" />
            {startLabel}
          </button>
          <Tooltip>
            {t.markup("cantMakeYet", { settings: (chunks) => chunks })}
          </Tooltip>
        </TooltipTrigger>
      </div>
    );
  } else if (button === "turnOn") {
    footer = (
      <Button
        onPress={onOpenSettings}
        className={`${FOOTER_BUTTON} bg-white/10 hover:bg-white/15`}
      >
        <Settings className="size-[18px]" aria-hidden="true" />
        {t("turnOnInSettings")}
      </Button>
    );
  }

  return (
    <SidePanel
      title={t("title")}
      closeLabel={t("close")}
      onClose={onClose}
      footer={footer}
    >
      {body}
    </SidePanel>
  );
}

/**
 * "AI notes on", in the top bar for everyone while they're on: who turned them on, where
 * what's said goes, whether what you say goes into them, and Don't transcribe me. Where this browser needs
 * its one-time download first, the chip is marked and this is where it's done, with its
 * progress. Hosts and co-hosts can open the notes from it.
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
  const sentence = useNotesSentence();
  /** Not in the notes until the one-time download is done. */
  const notYet = self === "download" || self === "downloading";
  // Once the download is done its box goes, with the focused button: focus stays in here.
  const dialog = useRef<HTMLElement>(null);
  const before = useRef(notYet);
  useEffect(() => {
    const was = before.current;
    before.current = notYet;
    if (!was || notYet) return;
    const node = dialog.current;
    if (node && !node.contains(document.activeElement)) node.focus();
  }, [notYet]);
  return (
    <PopoverTrigger>
      <Button
        aria-label={notYet ? t("chipNotYet") : t("chip")}
        className="bg-primary/25 hover:bg-primary/35 focus-visible:focus-ring relative flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-semibold outline-hidden"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        <span className="max-sm:hidden">{t("chip")}</span>
        {notYet ? (
          <span
            aria-hidden="true"
            className="ring-background absolute -top-1 -right-1 size-3 rounded-full bg-amber-400 ring-2"
          />
        ) : null}
      </Button>
      <Popover placement="bottom end" className="w-80">
        <Dialog
          ref={dialog}
          aria-label={t("title")}
          className="flex flex-col gap-2 p-1.5 outline-none"
        >
          {({ close }) => (
            <>
              <p className="text-sm leading-normal">
                {t("banner", { name: notes.name })}
              </p>
              {notes.madeWith ? (
                <p className="text-muted-foreground text-[13px] leading-normal">
                  {sentence.madeWith(notes.madeWith, notes.name)}
                </p>
              ) : null}
              {notYet ? (
                <div className="flex flex-col gap-2 rounded-[10px] bg-white/5 p-3">
                  <p className="text-sm font-semibold">{t("notYetTitle")}</p>
                  <p
                    role="status"
                    className="text-muted-foreground text-[13px] leading-normal"
                  >
                    {t(`self.${self}`)}
                  </p>
                  <Button
                    isPending={self === "downloading"}
                    onPress={onDownload}
                    className={POPOVER_BUTTON}
                  >
                    {self === "downloading" ? (
                      <LoaderCircle
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Download className="size-4" aria-hidden="true" />
                    )}
                    {self === "downloading"
                      ? t("downloadingButton")
                      : t("downloadNow")}
                  </Button>
                </div>
              ) : self === "off" || self === "checking" ? null : (
                <p role="status" className="text-muted-foreground text-[13px]">
                  {t(`self.${self}`)}
                </p>
              )}
              {/* Nothing to leave out where this browser can't transcribe at all. */}
              {self === "unsupported" ? null : (
                <SwitchRow
                  label={t("dontTranscribe")}
                  help={t("dontTranscribeHelp")}
                  isSelected={self === "optedOut"}
                  onChange={onOptOutChange}
                />
              )}
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

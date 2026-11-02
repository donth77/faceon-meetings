"use client";

import { LoaderCircle, Save, Settings, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { NewTabNote } from "@/components/ui/new-tab-note";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { autoSharing } from "@/lib/meetings/rules";
import type { NotesProgress } from "@/lib/notes/engines";
import { PROVIDER_INFO } from "@/lib/notes/providers";
import {
  transcriptText,
  type MadeNotes,
  type TranscriptLine,
} from "@/lib/notes/transcript";
import { useIntlLocale } from "@/lib/preferences";

import {
  NOTES_ACTION as ACTION,
  NotesFileButtons,
  useNotesMarkdown,
} from "./notes-file";
import { NotesView } from "./notes-view";
import { useNotesMaker, type SaveState } from "./use-notes-maker";

/** Where AI notes settings open: the meeting's Settings dialog, or the Settings page. */
export type SettingsLink = { onPress: () => void } | { href: string };

function SettingsButton({ settings }: { settings: SettingsLink }) {
  const t = useTranslations("Notes");
  const content = (
    <>
      <Settings className="size-4" aria-hidden="true" />
      {t("settings")}
    </>
  );
  return "href" in settings ? (
    <LinkButton
      href={settings.href}
      target="_blank"
      variant="outline"
      className={ACTION}
    >
      {content}
      <NewTabNote />
    </LinkButton>
  ) : (
    <Button variant="outline" className={ACTION} onPress={settings.onPress}>
      {content}
    </Button>
  );
}

function ProgressText({ progress }: { progress: NotesProgress | null }) {
  const t = useTranslations("Notes");
  const locale = useIntlLocale();
  if (progress?.phase === "download") {
    const percent = new Intl.NumberFormat(locale, { style: "percent" }).format(
      progress.done,
    );
    return t("downloading", { percent });
  }
  if (progress?.phase === "merging") return t("merging");
  if (progress?.phase === "reading" && progress.parts > 1) {
    return t("readingPart", { part: progress.part, parts: progress.parts });
  }
  return t("making");
}

/** Saving the notes with the meeting, for Previous: privately, or shared with attendees. */
function SaveControls({
  made,
  sessionId,
  saveState,
  transcriptLeftOut,
  onSave,
}: {
  made: MadeNotes;
  sessionId: string;
  saveState: SaveState;
  transcriptLeftOut: boolean;
  onSave: (shared: boolean) => void;
}) {
  const t = useTranslations("Notes");
  const saving = saveState === "saving";
  const shared = made.saved?.shared === true;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {made.saved ? null : (
          <Button
            variant="outline"
            className={ACTION}
            isPending={saving}
            onPress={() => onSave(false)}
          >
            <Save className="size-4" aria-hidden="true" />
            {t("save")}
          </Button>
        )}
        <Button
          variant={shared ? "outline" : "default"}
          className={ACTION}
          isPending={saving}
          onPress={() => onSave(!shared)}
        >
          <Users className="size-4" aria-hidden="true" />
          {shared ? t("stopSharing") : t("share")}
        </Button>
      </div>
      <div role="status" className="text-[13px] leading-normal empty:hidden">
        {saveState === "failed" ? (
          <p className="text-destructive-text">{t("saveFailed")}</p>
        ) : made.saved ? (
          <p className="text-muted-foreground flex flex-wrap gap-x-1">
            <span>{shared ? t("savedShared") : t("savedPrivate")}</span>
            {transcriptLeftOut ? <span>{t("transcriptLeftOut")}</span> : null}
            <Link
              href={`/previous/${sessionId}/notes`}
              target="_blank"
              className="text-primary font-semibold underline-offset-4 hover:underline"
            >
              {t("openSaved")}
              <NewTabNote />
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The notes, how and when they were made, saving, Copy and Download, and Make again. */
function MadeNotesView({
  made,
  outdated,
  title,
  lines,
  settings,
  save,
  cantShare,
  onMakeAgain,
}: {
  made: MadeNotes;
  /** Made before the end of the transcript (AI notes went on again since). */
  outdated: boolean;
  title: string;
  lines: readonly TranscriptLine[];
  /** To make them another way, again. */
  settings: SettingsLink;
  /** Saving with the meeting; absent for guests, who have no account to save with. */
  save:
    | {
        sessionId: string;
        state: SaveState;
        transcriptLeftOut: boolean;
        onSave: (shared: boolean) => void;
      }
    | undefined;
  /** The meeting shares AI notes, but these can't be saved (no account): say so. */
  cantShare: boolean;
  onMakeAgain: () => void;
}) {
  const t = useTranslations("Notes");
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone,
  });

  const toMarkdown = useNotesMarkdown();
  const markdown = () =>
    toMarkdown({
      title,
      when: new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone,
      }).format(made.madeAt),
      notes: made.notes,
      transcript: transcriptText(lines, (at) => time.format(at)),
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-[13px]">
        {made.provider
          ? t("madeWith", {
              provider: PROVIDER_INFO[made.provider].name,
              time: time.format(made.madeAt),
            })
          : t("madeOnDevice", { time: time.format(made.madeAt) })}
      </p>
      {outdated ? (
        <p role="status" className="text-sm leading-normal font-semibold">
          {t("outdated")}
        </p>
      ) : null}
      <NotesView notes={made.notes} />
      {save ? (
        <SaveControls
          made={made}
          sessionId={save.sessionId}
          saveState={save.state}
          transcriptLeftOut={save.transcriptLeftOut}
          onSave={save.onSave}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <NotesFileButtons title={title} markdown={markdown} />
        <Button variant="outline" className={ACTION} onPress={onMakeAgain}>
          <Sparkles className="size-4" aria-hidden="true" />
          {t("makeAgain")}
        </Button>
        <SettingsButton settings={settings} />
      </div>
      <p className="text-muted-foreground text-[13px] leading-normal">
        {made.saved
          ? t("audioNeverStored")
          : cantShare
            ? t("autoShareNeedsAccount")
            : save
              ? t("onlyYou")
              : t("onlyYouGuest")}
      </p>
    </div>
  );
}

/**
 * Turns the transcript into notes, the way Settings → AI notes says: on this computer or
 * with the host's key. With `autoStart`, it starts by itself where it can without asking.
 */
export function NotesMaker({
  code,
  sessionId,
  canSave,
  title,
  lines,
  settings,
  autoStart = false,
  autoShare = false,
  onDiscard,
}: {
  code: string;
  /** The session the transcript is from, which saved notes belong to. */
  sessionId: string;
  /** Signed in: notes can be saved with the meeting. */
  canSave: boolean;
  title: string;
  lines: readonly TranscriptLine[];
  settings: SettingsLink;
  autoStart?: boolean;
  /**
   * The meeting shares AI notes with its participants: saved and shared as soon as
   * they're made, or, where they can't be saved (no account), it says so.
   */
  autoShare?: boolean;
  /** Deletes the transcript and the notes from this tab. */
  onDiscard: () => void;
}) {
  const t = useTranslations("Notes");
  const maker = useNotesMaker({ code, sessionId, title, lines });
  const { state } = maker;
  const [confirming, setConfirming] = useState(false);
  const provider = PROVIDER_INFO[maker.provider].name;

  // Each step replaces the button that led to it; focus moves to the new step rather
  // than falling to the page, so keyboard users (and Escape) stay here.
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const focused = document.activeElement;
    if (!focused || focused === document.body) bodyRef.current?.focus();
  }, [state.step]);

  // Stopping AI notes, or leaving, makes the notes at once where nothing needs asking
  // (Chrome's model already on this computer, or a key), and makes them again when the
  // transcript has grown since. Never a download nobody asked for.
  const started = useRef(false);
  const start = useEffectEvent(() => void maker.make());
  const instant =
    maker.engine === "onDevice" ? maker.onDevice === "ready" : maker.ready;
  const due =
    state.step === "ready" || (state.step === "done" && maker.outdated);
  useEffect(() => {
    if (!autoStart || started.current || !due || !instant) return;
    started.current = true;
    start();
  }, [autoStart, due, instant]);

  // Shared as soon as they're made, once; afterwards Stop sharing (here or in Previous)
  // is the notetaker's, as is saving notes made again.
  const sharing = autoSharing({
    shareNotes: autoShare,
    canSave,
    saved: state.step === "done" && state.made.saved !== undefined,
  });
  const autoShared = useRef(false);
  const share = useEffectEvent(() => void maker.save(true));
  useEffect(() => {
    if (state.step !== "done" || sharing !== "share" || autoShared.current) {
      return;
    }
    autoShared.current = true;
    share();
  }, [state.step, sharing]);

  let body;
  switch (state.step) {
    case "done":
      body = (
        <MadeNotesView
          made={state.made}
          outdated={maker.outdated}
          title={title}
          lines={lines}
          settings={settings}
          save={
            canSave
              ? {
                  sessionId,
                  state: maker.saveState,
                  transcriptLeftOut: maker.transcriptLeftOut,
                  onSave: (shared) => void maker.save(shared),
                }
              : undefined
          }
          cantShare={sharing === "cantSave"}
          onMakeAgain={() => void maker.make()}
        />
      );
      break;
    case "making":
      body = (
        <div className="flex flex-col gap-3">
          <p
            role="status"
            className="flex items-center gap-2.5 text-[15px] font-semibold"
          >
            <LoaderCircle
              className="text-primary size-5 animate-spin"
              aria-hidden="true"
            />
            <ProgressText progress={state.progress} />
          </p>
          <Button
            variant="outline"
            className={`${ACTION} self-start`}
            onPress={maker.cancel}
          >
            {t("cancel")}
          </Button>
        </div>
      );
      break;
    default: {
      const { onDevice } = maker;
      /** Making them starts Chrome's one-time model download, so the button says so. */
      const downloadFirst =
        maker.engine === "onDevice" && onDevice === "download";
      const notReady =
        maker.engine === "ownKey"
          ? maker.ready
            ? null
            : t("notReady.noKey", { provider })
          : onDevice === "update" ||
              onDevice === "enable" ||
              onDevice === "none"
            ? t(`notReady.${onDevice}`)
            : null;
      body = (
        <div className="flex flex-col gap-3 text-sm leading-normal">
          {state.step === "failed" ? (
            <p
              role="alert"
              className="text-destructive-text flex flex-wrap gap-x-1"
            >
              <span>{t(`failed.${state.failure.kind}`, { provider })}</span>
              {"detail" in state.failure && state.failure.detail ? (
                <span>
                  {t("providerSaid", {
                    provider,
                    detail: state.failure.detail,
                  })}
                </span>
              ) : null}
            </p>
          ) : (
            <p>{t("lineCount", { count: lines.length })}</p>
          )}
          <p className="text-muted-foreground">
            {maker.engine === "onDevice"
              ? t("engineOnDevice")
              : t("engineOwnKey", { provider })}
            {downloadFirst ? ` ${t("firstDownload")}` : ""}
          </p>
          {notReady ? (
            <p className="text-muted-foreground">{notReady}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              className={ACTION}
              isDisabled={!maker.ready || lines.length === 0}
              onPress={() => void maker.make()}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {state.step === "failed"
                ? t("tryAgain")
                : downloadFirst
                  ? t("downloadAndMake")
                  : t("make")}
            </Button>
            <SettingsButton settings={settings} />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={bodyRef} tabIndex={-1} className="outline-none">
        {body}
      </div>
      {state.step === "making" ? null : confirming ? (
        <div
          role="group"
          aria-label={t("discard")}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span>{t("discardConfirm")}</span>
          <Button
            variant="destructive"
            className={ACTION}
            onPress={() => {
              setConfirming(false);
              maker.discard();
              onDiscard();
            }}
          >
            {t("discardYes")}
          </Button>
          <Button
            variant="ghost"
            className={ACTION}
            onPress={() => setConfirming(false)}
          >
            {t("cancel")}
          </Button>
        </div>
      ) : (
        <Button
          variant="link"
          className="text-muted-foreground h-auto self-start p-0 text-[13px] font-semibold"
          onPress={() => setConfirming(true)}
        >
          {t("discard")}
        </Button>
      )}
    </div>
  );
}

"use client";

import { LoaderCircle, Save, Settings, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
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
          <p className="text-destructive">{t("saveFailed")}</p>
        ) : made.saved ? (
          <p className="text-muted-foreground">
            {shared ? t("savedShared") : t("savedPrivate")}{" "}
            {transcriptLeftOut ? `${t("transcriptLeftOut")} ` : ""}
            <Link
              href={`/previous/${sessionId}/notes`}
              target="_blank"
              className="text-primary font-semibold underline-offset-4 hover:underline"
            >
              {t("openSaved")}
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
  title,
  lines,
  settings,
  save,
  onMakeAgain,
}: {
  made: MadeNotes;
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
  onMakeAgain: () => void;
}) {
  const t = useTranslations("Notes");
  const locale = useIntlLocale();
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });

  const toMarkdown = useNotesMarkdown();
  const markdown = () =>
    toMarkdown({
      title,
      when: new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "short",
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

  // Stopping AI notes, or leaving, makes the notes at once where nothing needs asking:
  // Chrome's model already downloaded, or a key.
  const started = useRef(false);
  const start = useEffectEvent(() => void maker.make());
  const instant =
    maker.engine === "onDevice" ? maker.onDevice === "ready" : maker.ready;
  useEffect(() => {
    if (!autoStart || started.current || state.step !== "ready" || !instant) {
      return;
    }
    started.current = true;
    start();
  }, [autoStart, state.step, instant]);

  let body;
  switch (state.step) {
    case "done":
      body = (
        <MadeNotesView
          made={state.made}
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
            <p role="alert" className="text-destructive">
              {t(`failed.${state.failure.kind}`, { provider })}
              {"detail" in state.failure && state.failure.detail
                ? ` ${t("providerSaid", { provider, detail: state.failure.detail })}`
                : ""}
            </p>
          ) : (
            <p>{t("lineCount", { count: lines.length })}</p>
          )}
          <p className="text-muted-foreground">
            {maker.engine === "onDevice"
              ? t("engineOnDevice")
              : t("engineOwnKey", { provider })}
            {maker.engine === "onDevice" && maker.onDevice === "download"
              ? ` ${t("firstDownload")}`
              : ""}
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
              {state.step === "failed" ? t("tryAgain") : t("make")}
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

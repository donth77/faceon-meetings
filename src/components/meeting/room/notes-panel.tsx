"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button, Dialog } from "react-aria-components";

import { SwitchRow } from "@/components/schedule/fields";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import type { NotesState } from "@/lib/media/types";

import { SidePanel } from "./side-panel";

const FOOTER_BUTTON =
  "focus-visible:ring-ring flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold outline-none focus-visible:ring-2 disabled:opacity-60";

/**
 * AI notes, for the hosts and co-hosts who run them: what they do, then Start or Stop
 * for everyone. The live transcript fills it while they're on.
 */
export function NotesPanel({
  notes,
  demo,
  onChange,
  onClose,
  children,
}: {
  notes: NotesState | null;
  /** Demo meetings don't offer AI notes. */
  demo: boolean;
  /** Turns AI notes on or off, for everyone. */
  onChange: (on: boolean) => Promise<void>;
  onClose: () => void;
  /** What's been said so far, while they're on. */
  children?: ReactNode;
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4 text-sm leading-normal">
        {notes ? (
          <>
            <p>{t("onBy", { name: notes.name })}</p>
            {children}
          </>
        ) : (
          <>
            <p>{t("intro")}</p>
            <p className="text-muted-foreground">
              {demo ? t("notInDemo") : t("everyoneSees")}
            </p>
          </>
        )}
      </div>
    </SidePanel>
  );
}

/**
 * "AI notes on", in the top bar for everyone while they're on: who turned them on, and
 * Don't transcribe me. Hosts and co-hosts can open the notes from it.
 */
export function NotesChip({
  notes,
  optedOut,
  onOptOutChange,
  onOpenNotes,
}: {
  notes: NotesState;
  optedOut: boolean;
  onOptOutChange: (optedOut: boolean) => void;
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
          className="flex flex-col p-1.5 outline-none"
        >
          <p className="text-sm leading-normal">
            {t("banner", { name: notes.name })}
          </p>
          <SwitchRow
            label={t("dontTranscribe")}
            help={t("dontTranscribeHelp")}
            isSelected={optedOut}
            onChange={onOptOutChange}
          />
          {onOpenNotes ? (
            <Button
              onPress={onOpenNotes}
              className="focus-visible:ring-ring flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm font-semibold outline-none hover:bg-white/15 focus-visible:ring-2"
            >
              {t("open")}
            </Button>
          ) : null}
        </Dialog>
      </Popover>
    </PopoverTrigger>
  );
}

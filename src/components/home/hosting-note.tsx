"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, INPUT } from "@/components/ui/form-fields";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { publicEnv } from "@/lib/env";
import {
  askForFullMeetingsAction,
  dismissApprovalAction,
} from "@/lib/hosting/actions";
import { useIntlLocale } from "@/lib/preferences";

/** Where the person stands, as Home needs it (lib/hosting/rules.ts, HostingAccess). */
export type HostingNoteState =
  | { plan: "full"; justApproved: boolean }
  | { plan: "demo"; ask: "available" | "pending" }
  | { plan: "demo"; ask: "declined"; askAgainAt: string };

type Terms = {
  /** `left`: demo meetings the host can still start today, of `perDay`. */
  demo: { minutes: number; people: number; perDay: number; left: number };
  full: { minutes: number; people: number };
};

const NOTE_MAX = 500;

/**
 * Home's hosting note. Demo hosts see their limits, with Ask for full meetings (or where
 * their request stands); someone just approved sees that once.
 */
export function HostingNote({
  state,
  terms,
}: {
  state: HostingNoteState;
  terms: Terms;
}) {
  const t = useTranslations("Hosting");
  const home = useTranslations("Home");
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [dismissing, startDismissing] = useTransition();

  if (state.plan === "full") {
    if (!state.justApproved) return null;
    return (
      <div
        role="status"
        className="bg-secondary text-secondary-foreground flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3.5 py-2.5 text-sm"
      >
        <CircleCheck
          className="text-live-text size-5 shrink-0"
          aria-hidden="true"
        />
        <p className="min-w-[min(100%,15rem)] flex-1">
          {t("approved", terms.full)}
        </p>
        <Button
          variant="outline"
          size="sm"
          isPending={dismissing}
          onPress={() =>
            startDismissing(async () => {
              await dismissApprovalAction();
              router.refresh();
            })
          }
        >
          {t("dismiss")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-amber-100 px-3.5 py-2.5 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
      <p className="min-w-[min(100%,15rem)] flex-1">
        {home.rich("demoNote", {
          ...terms.demo,
          link: (chunks) => (
            <Link
              href="/help/meeting-limits"
              className="focus-visible:focus-ring rounded-[2px] font-semibold underline underline-offset-4 outline-hidden"
            >
              {chunks}
            </Link>
          ),
        })}{" "}
        {state.ask === "pending"
          ? t("pending")
          : state.ask === "declined"
            ? t("declined", {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: "long",
                  timeZone,
                }).format(new Date(state.askAgainAt)),
              })
            : null}
      </p>
      {state.ask === "available" ? (
        <Button
          variant="outline"
          size="sm"
          className="border-amber-950/30 bg-transparent hover:bg-amber-950/5 dark:border-amber-100/30 dark:hover:bg-amber-100/10"
          onPress={() => setAsking(true)}
        >
          {t("ask")}
        </Button>
      ) : null}
      {asking ? (
        <AskDialog
          full={terms.full}
          onClose={(sent) => {
            setAsking(false);
            if (sent) router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/** "Ask to host full meetings", with an optional note for the admins. */
function AskDialog({
  full,
  onClose,
}: {
  full: Terms["full"];
  onClose: (sent: boolean) => void;
}) {
  const t = useTranslations("Hosting");
  const noteId = useId();
  const helpId = useId();
  const errorId = useId();
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim().length > NOTE_MAX) {
      setProblem(t("tooLong", { max: NOTE_MAX }));
      return;
    }
    startSending(async () => {
      const result = await askForFullMeetingsAction(note).catch(
        () => "failed" as const,
      );
      if (result === "sent") {
        toast.success(t("sent"));
        onClose(true);
      } else if (
        result === "pending" ||
        result === "full" ||
        result === "declined"
      ) {
        // Things changed since the page loaded: show where they stand now.
        onClose(true);
      } else {
        setProblem(
          t(
            result === "tooManyTries"
              ? "tooManyTries"
              : result === "invalid"
                ? "tooLong"
                : "failed",
            { max: NOTE_MAX },
          ),
        );
      }
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose(false);
      }}
      isDismissable={!sending}
      showCloseButton={false}
      className="sm:max-w-md"
    >
      <form onSubmit={send} className="flex flex-col gap-5" noValidate>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("askTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("askBody", {
              ...full,
              appName: publicEnv.NEXT_PUBLIC_APP_NAME,
            })}
          </DialogDescription>
        </DialogHeader>
        <Field label={t("noteLabel")} optional={t("optional")} htmlFor={noteId}>
          <textarea
            id={noteId}
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            placeholder={t("notePlaceholder")}
            aria-describedby={problem ? `${helpId} ${errorId}` : helpId}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => {
              setNote(event.target.value);
              setProblem(null);
            }}
            className={`${INPUT} h-auto resize-y py-2.5`}
          />
          <p id={helpId} className="text-muted-foreground text-[13px]">
            {t("noteHelp")}
          </p>
        </Field>
        {problem ? (
          <p
            id={errorId}
            role="alert"
            className="text-destructive-text text-sm"
          >
            {problem}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" slot="close" isDisabled={sending}>
            {t("cancel")}
          </Button>
          <Button type="submit" isPending={sending}>
            {t("send")}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

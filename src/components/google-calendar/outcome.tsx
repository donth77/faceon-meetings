"use client";

import { CalendarCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";
import {
  connectProblem,
  type CalendarOutcome,
} from "@/lib/google-calendar/shared";
import { syncGoogleCalendarAction } from "@/lib/meetings/schedule-actions";

import { connectInBrowserInstead, connectInPopup } from "./connect";

/** Tries Google Calendar again for a meeting; a failed request counts as "failed". */
const retrySync = (code: string): Promise<CalendarOutcome> =>
  syncGoogleCalendarAction(code)
    .then((outcome) => outcome ?? "synced")
    .catch(() => "failed" as const);

/** Reconnects in a consent window, then tries again; null if it didn't connect. */
function useReconnectAndRetry(email: string) {
  const t = useTranslations("GoogleCalendar");
  return async (code: string): Promise<CalendarOutcome | null> => {
    if (connectInBrowserInstead()) {
      toast(t("inBrowser"));
      return null;
    }
    const report = await connectInPopup({
      back: `${window.location.pathname}${window.location.search}`,
      loginHint: email,
    });
    if (!report) return null;
    if (report.connection.status !== "connected") {
      toast.error(
        t(`problems.${connectProblem(report.error)}`, {
          email,
          appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        }),
      );
      return null;
    }
    return retrySync(code);
  };
}

/**
 * After an edit or delete of a synced meeting: when Google Calendar didn't take it,
 * a toast says so, with Retry, or Reconnect when Google needs that first. The meeting
 * itself is saved either way.
 */
export function useCalendarProblemToast(email: string) {
  const t = useTranslations("GoogleCalendar");
  const reconnect = useReconnectAndRetry(email);

  function settled(outcome: CalendarOutcome | null, code: string) {
    if (outcome === "synced") toast.success(t("retried"));
    else if (outcome) show(outcome, code);
  }

  function show(outcome: CalendarOutcome | undefined, code: string) {
    if (outcome === "failed") {
      toast.error(t("updateFailed"), {
        duration: 15_000,
        action: {
          label: t("retry"),
          onClick: () => void retrySync(code).then((o) => settled(o, code)),
        },
      });
    } else if (outcome === "reconnect") {
      toast.error(t("updateReconnect"), {
        duration: 15_000,
        action: {
          label: t("reconnect"),
          onClick: () => void reconnect(code).then((o) => settled(o, code)),
        },
      });
    }
  }
  return show;
}

/**
 * "Meeting scheduled": what Google Calendar did with it. Added (and how many people
 * Google invited), or why not, with Retry or Reconnect right here.
 */
export function CalendarOutcomeNote({
  outcome: initial,
  code,
  invited,
  email,
}: {
  outcome: CalendarOutcome;
  code: string;
  /** How many people Google emailed. */
  invited: number;
  email: string;
}) {
  const t = useTranslations("GoogleCalendar");
  const reconnect = useReconnectAndRetry(email);
  const [outcome, setOutcome] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function again() {
    setBusy(true);
    const next =
      outcome === "reconnect" ? await reconnect(code) : await retrySync(code);
    setBusy(false);
    if (next) setOutcome(next);
  }

  if (outcome === "synced") {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-xl bg-[#ddf5e8] px-3.5 py-3 text-sm leading-[1.45] text-[#0b5c35] dark:bg-emerald-400/15 dark:text-emerald-100"
      >
        <CalendarCheck
          className="mt-px size-[18px] shrink-0"
          aria-hidden="true"
        />
        {invited > 0 ? t("addedInvited", { count: invited }) : t("added")}
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-xl bg-amber-100 px-3.5 py-3 text-sm leading-[1.45] text-amber-950 dark:bg-amber-400/15 dark:text-amber-100"
    >
      <span className="flex min-w-0 flex-[1_1_240px] items-start gap-2.5">
        <TriangleAlert
          className="mt-px size-[18px] shrink-0 opacity-75"
          aria-hidden="true"
        />
        {outcome === "reconnect" ? t("addReconnect") : t("addFailed")}
      </span>
      <Button
        variant="outline"
        className="h-9 rounded-[10px]"
        isPending={busy}
        onPress={() => void again()}
      >
        {outcome === "reconnect" ? t("reconnect") : t("retry")}
      </Button>
    </div>
  );
}

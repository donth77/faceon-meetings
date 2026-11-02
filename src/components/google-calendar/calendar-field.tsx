"use client";

import { CalendarCheck, CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ReactNode, type Ref } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { dismiss, useDismissed } from "@/lib/dismissals";
import { publicEnv } from "@/lib/env";
import {
  connectProblem,
  type CalendarConnection,
} from "@/lib/google-calendar/shared";

import { connectInPopup } from "./connect";

const OUTLINE =
  "h-[38px] shrink-0 rounded-[10px] border-[#c9cfd8] px-3.5 text-sm font-semibold dark:border-white/15";

function Row({
  icon,
  titleId,
  title,
  lines,
  action,
  ref,
}: {
  icon: ReactNode;
  titleId: string;
  title: string;
  lines: Array<{ id?: string; text: string }>;
  action: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className="bg-muted ring-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl px-3.5 py-3 ring-1 ring-inset"
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-start gap-3">
        <span className="bg-card ring-border text-primary flex size-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span id={titleId} className="text-[15px] font-semibold">
            {title}
          </span>
          {lines.map((line) => (
            <span
              key={line.text}
              id={line.id}
              className="text-muted-foreground text-[13px] leading-snug"
            >
              {line.text}
            </span>
          ))}
        </div>
      </div>
      {action}
    </div>
  );
}

/** The first thing after `element` that Tab would reach, for focus to go to as it leaves. */
function nextFocusable(element: HTMLElement): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  );
  for (const candidate of candidates) {
    if (
      !element.contains(candidate) &&
      element.compareDocumentPosition(candidate) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * The schedule form's Google Calendar row: "Add to my Google Calendar and send
 * invitations" once connected, a way to connect (or reconnect) right here otherwise,
 * and a note when the meeting being edited is on the calendar already. The suggestion to
 * connect can be put away for good on this device (Settings → Calendar still connects);
 * a reconnect warning can't, or invitations would stop without anyone knowing.
 */
export function GoogleCalendarField({
  connection: initial,
  synced,
  value,
  onChange,
  email,
}: {
  connection: CalendarConnection;
  /** Editing a meeting that's already on the host's Google Calendar. */
  synced: boolean;
  value: boolean;
  onChange: (on: boolean) => void;
  /** The host's email, so Google offers the matching account. */
  email: string;
}) {
  const t = useTranslations("GoogleCalendar");
  const titleId = useId();
  const helpId = useId();
  const [connection, setConnection] = useState(initial);
  const [connecting, setConnecting] = useState(false);
  const suggestion = useRef<HTMLDivElement>(null);
  const suggestionHidden = useDismissed("calendarSuggestion", {
    hiddenOnServer: false,
  });

  if (connection.status === "unavailable") return null;

  async function connect() {
    setConnecting(true);
    const report = await connectInPopup({
      back: `${window.location.pathname}${window.location.search}`,
      loginHint: email,
    });
    setConnecting(false);
    if (!report) return;
    setConnection(report.connection);
    if (report.connection.status === "connected") {
      onChange(true);
      toast.success(t("connected"));
    } else {
      toast.error(
        t(`problems.${connectProblem(report.error)}`, {
          email,
          appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        }),
      );
    }
  }

  const connectButton = (label: string) => (
    <Button
      variant="outline"
      className={OUTLINE}
      isPending={connecting}
      onPress={() => void connect()}
    >
      {label}
    </Button>
  );
  const needsReconnect = connection.status === "reconnect";

  if (synced) {
    return (
      <Row
        icon={<CalendarCheck className="size-5" aria-hidden="true" />}
        titleId={titleId}
        title={t("onCalendar")}
        lines={[
          {
            text: needsReconnect
              ? t("reconnectHelp", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })
              : t("onCalendarHelp"),
          },
        ]}
        action={needsReconnect ? connectButton(t("reconnect")) : null}
      />
    );
  }
  if (connection.status === "connected") {
    return (
      <Row
        icon={<CalendarDays className="size-5" aria-hidden="true" />}
        titleId={titleId}
        title={t("add")}
        lines={[
          { text: t("connectedAs", { email: connection.email }) },
          { id: helpId, text: t("addHelp") },
        ]}
        action={
          <Switch
            isSelected={value}
            onChange={onChange}
            aria-labelledby={titleId}
            aria-describedby={helpId}
          />
        }
      />
    );
  }
  if (needsReconnect) {
    return (
      <Row
        icon={<CalendarDays className="size-5" aria-hidden="true" />}
        titleId={titleId}
        title={t("add")}
        lines={[
          {
            text: t("reconnectHelp", {
              appName: publicEnv.NEXT_PUBLIC_APP_NAME,
            }),
          },
        ]}
        action={connectButton(t("reconnect"))}
      />
    );
  }
  if (suggestionHidden) return null;

  // The row goes away with the button pressed in it: focus moves on to the form first.
  function hideSuggestion() {
    const row = suggestion.current;
    if (row) nextFocusable(row)?.focus();
    dismiss("calendarSuggestion");
    toast(t("suggestionHidden"));
  }

  return (
    <Row
      ref={suggestion}
      icon={<CalendarDays className="size-5" aria-hidden="true" />}
      titleId={titleId}
      title={t("add")}
      lines={[{ text: t("connectHelp") }]}
      action={
        <div className="flex flex-wrap gap-2">
          {connectButton(t("connect"))}
          <Button
            variant="ghost"
            className="h-[38px] rounded-[10px] px-3 text-sm font-semibold"
            onPress={hideSuggestion}
          >
            {t("notNow")}
          </Button>
        </div>
      }
    />
  );
}

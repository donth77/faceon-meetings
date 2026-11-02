"use client";

import { Copy, Pencil, Repeat, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button as AriaButton, Dialog } from "react-aria-components";

import { Button, LinkButton } from "@/components/ui/button";
import { fromRRule, recurrenceChip } from "@/lib/meetings/describe";
import type { OccurrenceRow } from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import { editMeetingPath } from "@/lib/routes";
import { formatDay, formatTimeRange } from "@/lib/time";

import { useScheduledInvitation } from "../invitation";

/** The popover a meeting opens from the calendar. */
export const POPOVER =
  "bg-popover text-popover-foreground rounded-[14px] shadow-[0_18px_44px_rgba(18,22,28,0.22)] ring-1 ring-black/10 outline-hidden dark:ring-white/10";

const ONE_OFF = "#4f5966";
/** Dark enough for white text (4.5:1 or more), and told apart by name too. */
const SERIES = [
  "#8a5a00",
  "#13804b",
  "#1f5eff",
  "#5b4db3",
  "#b4235a",
  "#0e7490",
];

/** One-off meetings share slate; each repeating series keeps its own color. */
export function colorOf(row: OccurrenceRow): string {
  if (!row.rrule) return ONE_OFF;
  let hash = 0;
  for (const char of row.code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SERIES[hash % SERIES.length] ?? ONE_OFF;
}

/** Click a meeting: when, how it repeats, your role, and Join, Copy invitation, Edit. */
export function MeetingPopover({
  row,
  timeZone,
}: {
  row: OccurrenceRow;
  timeZone: string;
}) {
  const t = useTranslations("Upcoming");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const title = row.title ?? t("untitled", { name: row.hostName });
  const start = new Date(row.start);
  const end = new Date(row.end);
  const recurrence = row.rrule ? fromRRule(row.rrule, row.timeZone) : null;
  const invitation = useScheduledInvitation({
    code: row.code,
    passcode: row.passcode,
    hostName: row.hostName,
    title,
    start,
    end,
    timeZone: row.timeZone,
    startDate: row.seriesStartDate,
    recurrence,
    invitees: [],
  });
  const isHost = row.role === "host";
  const day = formatDay(start, locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
  return (
    <Dialog
      aria-label={title}
      className="flex w-[300px] flex-col gap-2.5 p-4 outline-hidden"
    >
      {({ close }) => (
        <>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1.5 size-3 shrink-0 rounded"
              style={{ background: colorOf(row) }}
            />
            <h3 className="min-w-0 flex-1 text-[17px] font-bold">{title}</h3>
            <AriaButton
              aria-label={t("close")}
              onPress={close}
              className="hover:bg-accent data-focus-visible:focus-ring -mt-1 -mr-1 flex size-8 items-center justify-center rounded-lg outline-hidden"
            >
              <X className="size-4" aria-hidden="true" />
            </AriaButton>
          </div>
          <span className="text-sm">
            {day} · {formatTimeRange(start, end, timeZone, locale)}
          </span>
          {recurrence ? (
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <Repeat className="size-4" aria-hidden="true" />
              {recurrenceChip(tr, recurrence)}
            </span>
          ) : null}
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <Users className="size-4" aria-hidden="true" />
            {isHost
              ? t("youHost", { count: row.invitedCount })
              : t("hostedBy", { name: row.hostName })}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            <LinkButton href={invitation.link} className="h-9 rounded-[10px]">
              {isHost ? t("start") : t("join")}
            </LinkButton>
            <Button
              variant="outline"
              className="h-9 rounded-[10px]"
              onPress={() => void invitation.copyInvitation()}
            >
              <Copy aria-hidden="true" />
              {t("copyInvitation")}
            </Button>
            {isHost ? (
              <LinkButton
                variant="outline"
                className="h-9 rounded-[10px]"
                href={editMeetingPath(
                  row.code,
                  recurrence ? row.originalStart : null,
                )}
              >
                <Pencil aria-hidden="true" />
                {t("edit")}
              </LinkButton>
            ) : null}
          </div>
        </>
      )}
    </Dialog>
  );
}

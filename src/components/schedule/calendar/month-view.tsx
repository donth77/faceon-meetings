"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import {
  Button as AriaButton,
  DialogTrigger,
  Popover,
} from "react-aria-components";

import {
  dayAsDate,
  dayOf,
  minutesOfDay,
  sameMonth,
  type DayKey,
} from "@/lib/calendar-dates";
import type { OccurrenceRow } from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import { formatDay } from "@/lib/time";

import { colorOf, MeetingPopover, POPOVER } from "./meeting-popover";

/** A meeting in the month grid: a dot, the short time and the title. */
function MonthEntry({
  row,
  timeZone,
}: {
  row: OccurrenceRow;
  timeZone: string;
}) {
  const locale = useIntlLocale();
  const start = new Date(row.start);
  const onTheHour = minutesOfDay(start, timeZone) % 60 === 0;
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    ...(onTheHour ? {} : { minute: "2-digit" }),
  }).format(start);
  return (
    <DialogTrigger>
      <AriaButton className="hover:bg-accent data-focus-visible:focus-ring-inset flex min-h-6 w-full items-center gap-1.5 rounded-md px-1 text-left text-xs leading-[18px] outline-hidden">
        <span
          aria-hidden="true"
          className="size-[7px] shrink-0 rounded-full"
          style={{ background: colorOf(row) }}
        />
        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
          {time}
        </span>
        <span className="min-w-0 truncate">{row.title ?? row.hostName}</span>
      </AriaButton>
      <Popover placement="end top" className={POPOVER}>
        <MeetingPopover row={row} timeZone={timeZone} />
      </Popover>
    </DialogTrigger>
  );
}

/**
 * A month as a table of weeks, each day with its first three meetings. It's a table,
 * not a grid: Tab moves between meetings, as everywhere else.
 */
export function MonthView({
  days,
  anchor,
  rows,
  today,
  timeZone,
}: {
  days: DayKey[];
  anchor: DayKey;
  rows: OccurrenceRow[];
  today: DayKey;
  timeZone: string;
}) {
  const t = useTranslations("Upcoming");
  const locale = useIntlLocale();
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const label = (day: DayKey) =>
    formatDay(dayAsDate(day), locale, {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  const byDay = new Map<DayKey, OccurrenceRow[]>();
  for (const row of rows) {
    const day = dayOf(new Date(row.start), timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  return (
    <div
      role="table"
      aria-label={new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(dayAsDate(anchor))}
      className="bg-card ring-border overflow-hidden rounded-[14px] ring-1"
    >
      <div role="row" className="grid grid-cols-7 border-b">
        {days.slice(0, 7).map((day) => (
          <div
            key={day}
            role="columnheader"
            className="text-muted-foreground px-2 py-2 text-xs font-bold tracking-[0.04em] uppercase"
          >
            {weekday.format(dayAsDate(day))}
          </div>
        ))}
      </div>
      {Array.from({ length: days.length / 7 }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7">
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const entries = byDay.get(day) ?? [];
            const isToday = day === today;
            const outside = !sameMonth(day, anchor);
            return (
              <div
                key={day}
                role="cell"
                aria-label={label(day)}
                className={cn(
                  "flex min-h-[118px] flex-col gap-0.5 border-r border-b p-1.5 last:border-r-0",
                  isToday && "bg-chip/60",
                  outside && !isToday && "bg-muted/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mb-0.5 flex h-[26px] min-w-[26px] items-center justify-center self-start rounded-full px-1.5 text-[13px] font-medium",
                    isToday && "bg-primary text-primary-foreground font-bold",
                    outside && !isToday && "text-muted-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                {entries.slice(0, 3).map((row) => (
                  <MonthEntry
                    key={`${row.code}:${row.originalStart}`}
                    row={row}
                    timeZone={timeZone}
                  />
                ))}
                {entries.length > 3 ? (
                  <span className="text-muted-foreground px-1 text-xs font-semibold">
                    {t("more", { count: entries.length - 3 })}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

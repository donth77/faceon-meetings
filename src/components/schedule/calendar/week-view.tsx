"use client";

import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import {
  Button as AriaButton,
  DialogTrigger,
  Popover,
} from "react-aria-components";

import {
  dayAsDate,
  dayOf,
  lanesOf,
  minutesOfDay,
  type DayKey,
} from "@/lib/calendar-dates";
import type { OccurrenceRow } from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import { formatDay } from "@/lib/time";

import { colorOf, MeetingPopover, POPOVER } from "./meeting-popover";

const HOUR_PX = 52;

/**
 * A week: a table with the days as columns and meetings placed by time, a line at the
 * current time, opened at 8 a.m.
 */
export function WeekView({
  days,
  rows,
  now,
  timeZone,
}: {
  days: DayKey[];
  rows: OccurrenceRow[];
  now: number;
  timeZone: string;
}) {
  const t = useTranslations("Upcoming");
  const locale = useIntlLocale();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 8 * HOUR_PX;
  }, []);
  // Hour labels name civil hours, so they're formatted in UTC from a UTC day.
  const hour = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    timeZone: "UTC",
  });
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const today = dayOf(new Date(now), timeZone);
  const minutesNow = minutesOfDay(new Date(now), timeZone);
  const first = days[0] ?? today;
  const byDay = new Map<DayKey, OccurrenceRow[]>();
  for (const row of rows) {
    const day = dayOf(new Date(row.start), timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }

  return (
    <div
      role="table"
      aria-label={t("weekOf", {
        date: new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(dayAsDate(first)),
      })}
      className="bg-card ring-border overflow-hidden rounded-[14px] ring-1"
    >
      <div role="row" className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
        {/* Keeps its grid column; only the name is hidden. */}
        <div role="columnheader">
          <span className="sr-only">{t("time")}</span>
        </div>
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div
              key={day}
              role="columnheader"
              className="flex flex-col items-center gap-1 py-2"
            >
              <span
                className={cn(
                  "text-xs font-bold tracking-[0.04em] uppercase",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {weekday.format(dayAsDate(day))}
              </span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-[17px] font-bold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {Number(day.slice(8))}
              </span>
            </div>
          );
        })}
      </div>
      <div ref={scroller} className="max-h-[580px] overflow-y-auto">
        <div
          role="row"
          className="relative grid grid-cols-[56px_repeat(7,1fr)]"
          style={{ height: 24 * HOUR_PX }}
        >
          <div role="cell" className="relative">
            {Array.from({ length: 23 }, (_, h) => (
              <span
                key={h}
                aria-hidden="true"
                className="text-muted-foreground absolute right-2 font-mono text-[11px]"
                style={{ top: (h + 1) * HOUR_PX - 7 }}
              >
                {hour.format(new Date(Date.UTC(2026, 0, 1, h + 1)))}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const entries = byDay.get(day) ?? [];
            const lanes = lanesOf(entries);
            const isToday = day === today;
            return (
              <div
                key={day}
                role="cell"
                aria-label={formatDay(dayAsDate(day), locale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                className={cn("relative border-l", isToday && "bg-chip/40")}
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
                }}
              >
                {entries.map((row) => {
                  const start = new Date(row.start);
                  const end = new Date(row.end);
                  const minutes = minutesOfDay(start, timeZone);
                  const duration = (end.getTime() - start.getTime()) / 60_000;
                  const lane = lanes.get(row) ?? { lane: 0, of: 1 };
                  return (
                    <DialogTrigger key={`${row.code}:${row.originalStart}`}>
                      <AriaButton
                        className="data-focus-visible:focus-ring absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-[15px] text-white outline-hidden"
                        style={{
                          top: (minutes * HOUR_PX) / 60 + 1,
                          height: Math.max(24, (duration * HOUR_PX) / 60 - 2),
                          left: `calc(${(lane.lane / lane.of) * 100}% + 3px)`,
                          width: `calc(${100 / lane.of}% - 6px)`,
                          background: colorOf(row),
                        }}
                      >
                        <span className="block truncate font-bold">
                          {row.title ?? row.hostName}
                        </span>
                        {duration >= 45 ? (
                          <span className="block truncate">
                            {time.formatRange(start, end)}
                          </span>
                        ) : null}
                      </AriaButton>
                      <Popover placement="end top" className={POPOVER}>
                        <MeetingPopover row={row} timeZone={timeZone} />
                      </Popover>
                    </DialogTrigger>
                  );
                })}
                {isToday ? (
                  <div
                    role="img"
                    aria-label={t("now", { time: time.format(now) })}
                    className="pointer-events-none absolute right-0 left-0 h-0.5 bg-[#e5484d]"
                    style={{ top: (minutesNow * HOUR_PX) / 60 }}
                  >
                    <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-[#e5484d]" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

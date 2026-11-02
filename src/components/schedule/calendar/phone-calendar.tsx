"use client";

import { cn } from "cn";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button as AriaButton } from "react-aria-components";

import { LinkButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { dayAsDate, dayOf, sameMonth, type DayKey } from "@/lib/calendar-dates";
import { fromRRule, recurrenceChip } from "@/lib/meetings/describe";
import type { OccurrenceRow } from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import { meetingPath } from "@/lib/routes";
import { formatDay } from "@/lib/time";

/** Phones: a compact month with dots on busy days, and the chosen day's meetings below. */
export function PhoneCalendar({
  anchor,
  days,
  rows,
  today,
  timeZone,
  onMove,
}: {
  anchor: DayKey;
  days: DayKey[];
  rows: OccurrenceRow[];
  today: DayKey;
  timeZone: string;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = useTranslations("Upcoming");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const [selected, setSelected] = useState(today);
  const dayOfRow = (row: OccurrenceRow) => dayOf(new Date(row.start), timeZone);
  const busy = new Set(rows.map(dayOfRow));
  const chosen = rows.filter((row) => dayOfRow(row) === selected);
  const letter = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  const longDay = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const label = (day: DayKey) =>
    formatDay(dayAsDate(day), locale, {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-card ring-border rounded-2xl p-2.5 ring-1">
        <div className="flex items-center justify-between">
          <AriaButton
            aria-label={t("previousMonth")}
            onPress={() => onMove(-1)}
            className="data-focus-visible:focus-ring flex size-10 items-center justify-center rounded-lg outline-hidden"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </AriaButton>
          {/* Announced when ‹ and › change the month. */}
          <span aria-live="polite" className="text-base font-bold">
            {new Intl.DateTimeFormat(locale, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(dayAsDate(anchor))}
          </span>
          <AriaButton
            aria-label={t("nextMonth")}
            onPress={() => onMove(1)}
            className="data-focus-visible:focus-ring flex size-10 items-center justify-center rounded-lg outline-hidden"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </AriaButton>
        </div>
        <div className="grid grid-cols-7 text-center">
          {days.slice(0, 7).map((day) => (
            <abbr
              key={day}
              title={longDay.format(dayAsDate(day))}
              className="text-muted-foreground py-1 text-xs font-bold no-underline"
            >
              {letter.format(dayAsDate(day))}
            </abbr>
          ))}
          {days.map((day) => {
            const isSelected = day === selected;
            const has = busy.has(day);
            return (
              <AriaButton
                key={day}
                aria-pressed={isSelected}
                aria-label={
                  has ? t("dayWithMeetings", { date: label(day) }) : label(day)
                }
                onPress={() => setSelected(day)}
                className={cn(
                  "data-focus-visible:focus-ring-strong flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[15px] outline-hidden",
                  day === today &&
                    !isSelected &&
                    "ring-primary font-bold ring-2 ring-inset",
                  isSelected && "bg-primary text-primary-foreground",
                  !sameMonth(day, anchor) &&
                    !isSelected &&
                    "text-muted-foreground",
                )}
              >
                {Number(day.slice(8))}
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-[5px] rounded-full",
                    has
                      ? isSelected
                        ? "bg-primary-foreground"
                        : "bg-primary"
                      : "bg-transparent",
                  )}
                />
              </AriaButton>
            );
          })}
        </div>
      </div>
      <h2 className="text-muted-foreground text-[15px] font-bold">
        {formatDay(dayAsDate(selected), locale, {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        })}
      </h2>
      {chosen.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {chosen.map((row) => {
            const recurrence = row.rrule
              ? fromRRule(row.rrule, row.timeZone)
              : null;
            return (
              <li
                key={`${row.code}:${row.originalStart}`}
                className="bg-card ring-border flex items-center gap-3 rounded-[14px] px-3.5 py-3 ring-1"
              >
                <span className="w-[70px] shrink-0 font-mono text-sm">
                  {time.format(new Date(row.start))}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[15px] font-bold">
                    {row.title ?? t("untitled", { name: row.hostName })}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {recurrence ? (
                      <Chip>
                        <Repeat className="size-3.5" aria-hidden="true" />
                        {recurrenceChip(tr, recurrence)}
                      </Chip>
                    ) : null}
                    <Chip tone="brand">
                      {row.role === "host" ? t("host") : t("invitedChip")}
                    </Chip>
                  </span>
                </div>
                <LinkButton
                  href={meetingPath(row.code, row.passcode)}
                  className="h-10 rounded-[10px]"
                >
                  {row.role === "host" ? t("start") : t("join")}
                </LinkButton>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">{t("nothingThatDay")}</p>
      )}
    </div>
  );
}

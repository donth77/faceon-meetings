"use client";

import { cn } from "cn";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Repeat,
  Users,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Popover,
  Radio,
  RadioGroup,
} from "react-aria-components";

import { Button, LinkButton } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNow } from "@/hooks/use-now";
import { fromRRule, recurrenceChip } from "@/lib/meetings/describe";
import {
  occurrencesAction,
  type OccurrenceRow,
} from "@/lib/meetings/schedule-actions";
import { deviceTimeZone, formatTimeRange, weekStartsOn } from "@/lib/time";

import { useScheduledInvitation } from "./invitation";

type Mode = "month" | "week";

const ONE_OFF = "#4f5966";
const SERIES = [
  "#8a5a00",
  "#13804b",
  "#1f5eff",
  "#5b4db3",
  "#b4235a",
  "#0e7490",
];
const HOUR_PX = 52;

/** One-off meetings share slate; each repeating series keeps its own color. */
function colorOf(row: OccurrenceRow): string {
  if (!row.rrule) return ONE_OFF;
  let hash = 0;
  for (const char of row.code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SERIES[hash % SERIES.length] ?? ONE_OFF;
}

const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) =>
  dayStart(a).getTime() === dayStart(b).getTime();
const weekOf = (d: Date, first: number) =>
  addDays(dayStart(d), -((d.getDay() - first + 7) % 7));

/** The days a view shows: whole weeks around a month, or one week. */
function daysOf(mode: Mode, anchor: Date, first: number): Date[] {
  if (mode === "week") {
    const start = weekOf(anchor, first);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = weekOf(monthStart, first);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const weeks = Math.ceil(
    ((monthEnd.getTime() - start.getTime()) / 86_400_000 + 1) / 7,
  );
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** The meetings between two moments, fetched when the range changes. */
function useOccurrences(from: Date, to: Date) {
  const key = `${from.toISOString()}|${to.toISOString()}`;
  const [data, setData] = useState<{ key: string; rows: OccurrenceRow[] }>();
  useEffect(() => {
    let cancelled = false;
    occurrencesAction(from.toISOString(), to.toISOString())
      .then((rows) => {
        if (!cancelled) setData({ key, rows });
      })
      .catch(() => {
        if (!cancelled) setData({ key, rows: [] });
      });
    return () => {
      cancelled = true;
    };
    // The key stands for from and to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return data?.key === key ? data.rows : null;
}

/** Click a meeting: when, how it repeats, your role, and Join, Copy invitation, Edit. */
function MeetingPopover({ row }: { row: OccurrenceRow }) {
  const t = useTranslations("Upcoming");
  const tr = useTranslations("Recurrence");
  const locale = useLocale();
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
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(start);
  return (
    <Dialog
      aria-label={title}
      className="flex w-[300px] flex-col gap-2.5 p-4 outline-none"
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
              className="focus-visible:ring-ring hover:bg-accent -mt-1 -mr-1 flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
            >
              <X className="size-4" aria-hidden="true" />
            </AriaButton>
          </div>
          <span className="text-sm">
            {day} · {formatTimeRange(start, end, deviceTimeZone(), locale)}
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
                href={`/meetings/${row.code}/edit${
                  recurrence
                    ? `?occurrence=${encodeURIComponent(row.originalStart)}`
                    : ""
                }`}
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

const POPOVER =
  "bg-popover text-popover-foreground rounded-[14px] shadow-[0_18px_44px_rgba(18,22,28,0.22)] ring-1 ring-black/10 outline-none dark:ring-white/10";

/** A meeting in the month grid: a dot, the short time and the title. */
function MonthEntry({ row }: { row: OccurrenceRow }) {
  const locale = useLocale();
  const start = new Date(row.start);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    ...(start.getMinutes() ? { minute: "2-digit" } : {}),
  }).format(start);
  return (
    <DialogTrigger>
      <AriaButton className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-1.5 rounded-md px-1 text-left text-xs leading-[18px] outline-none focus-visible:ring-2">
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
        <MeetingPopover row={row} />
      </Popover>
    </DialogTrigger>
  );
}

function MonthView({
  days,
  anchor,
  rows,
  today,
}: {
  days: Date[];
  anchor: Date;
  rows: OccurrenceRow[];
  today: Date;
}) {
  const t = useTranslations("Upcoming");
  const locale = useLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
  });
  return (
    <div
      role="grid"
      aria-label={new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(anchor)}
      className="bg-card overflow-hidden rounded-[14px] ring-1 ring-[#e2e5ea] dark:ring-white/10"
    >
      <div role="row" className="grid grid-cols-7 border-b">
        {days.slice(0, 7).map((day) => (
          <div
            key={day.toISOString()}
            role="columnheader"
            className="text-muted-foreground px-2 py-2 text-xs font-bold tracking-[0.04em] uppercase"
          >
            {weekday.format(day)}
          </div>
        ))}
      </div>
      {Array.from({ length: days.length / 7 }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7">
          {days.slice(week * 7, week * 7 + 7).map((day) => {
            const entries = rows.filter((row) =>
              sameDay(new Date(row.start), day),
            );
            const isToday = sameDay(day, today);
            const outside = day.getMonth() !== anchor.getMonth();
            return (
              <div
                key={day.toISOString()}
                role="gridcell"
                aria-label={label.format(day)}
                className={cn(
                  "flex min-h-[118px] flex-col gap-0.5 border-r border-b p-1.5 last:border-r-0",
                  isToday && "bg-[#f3f6ff] dark:bg-[#1f5eff]/10",
                  outside && "bg-[#fafbfc] dark:bg-white/[0.02]",
                )}
              >
                <span
                  className={cn(
                    "mb-0.5 flex h-[26px] min-w-[26px] items-center justify-center self-start rounded-full px-1.5 text-[13px] font-medium",
                    isToday && "bg-[#1f5eff] font-bold text-white",
                    outside && !isToday && "text-muted-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                {entries.slice(0, 3).map((row) => (
                  <MonthEntry
                    key={`${row.code}:${row.originalStart}`}
                    row={row}
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

/** Lanes for overlapping meetings in one day, so they sit side by side. */
function lanesOf(
  rows: OccurrenceRow[],
): Map<OccurrenceRow, { lane: number; of: number }> {
  const sorted = [...rows].sort((a, b) => a.start.localeCompare(b.start));
  const result = new Map<OccurrenceRow, { lane: number; of: number }>();
  let group: OccurrenceRow[] = [];
  let groupEnd = 0;
  const flush = () => {
    const ends: number[] = [];
    for (const row of group) {
      const start = new Date(row.start).getTime();
      let lane = ends.findIndex((end) => end <= start);
      if (lane === -1) lane = ends.length;
      ends[lane] = new Date(row.end).getTime();
      result.set(row, { lane, of: 0 });
    }
    for (const row of group) {
      const entry = result.get(row);
      if (entry) entry.of = ends.length;
    }
    group = [];
  };
  for (const row of sorted) {
    const start = new Date(row.start).getTime();
    if (group.length > 0 && start >= groupEnd) flush();
    group.push(row);
    groupEnd = Math.max(groupEnd, new Date(row.end).getTime());
  }
  flush();
  return result;
}

function WeekView({
  days,
  rows,
  now,
}: {
  days: Date[];
  rows: OccurrenceRow[];
  now: number;
}) {
  const t = useTranslations("Upcoming");
  const locale = useLocale();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 8 * HOUR_PX;
  }, []);
  const hour = new Intl.DateTimeFormat(locale, { hour: "numeric" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  const today = new Date(now);
  const first = days[0] ?? today;

  return (
    <div
      role="grid"
      aria-label={t("weekOf", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
          first,
        ),
      })}
      className="bg-card overflow-hidden rounded-[14px] ring-1 ring-[#e2e5ea] dark:ring-white/10"
    >
      <div role="row" className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
        <div className="text-muted-foreground flex items-end justify-center pb-2 text-[11px]" />
        {days.map((day) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              role="columnheader"
              className="flex flex-col items-center gap-1 py-2"
            >
              <span
                className={cn(
                  "text-xs font-bold tracking-[0.04em] uppercase",
                  isToday ? "text-[#1f5eff]" : "text-muted-foreground",
                )}
              >
                {weekday.format(day)}
              </span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-[17px] font-bold",
                  isToday && "bg-[#1f5eff] text-white",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>
      <div ref={scroller} className="max-h-[580px] overflow-y-auto">
        <div
          className="relative grid grid-cols-[56px_repeat(7,1fr)]"
          style={{ height: 24 * HOUR_PX }}
        >
          <div className="relative">
            {Array.from({ length: 23 }, (_, h) => (
              <span
                key={h}
                className="text-muted-foreground absolute right-2 font-mono text-[11px]"
                style={{ top: (h + 1) * HOUR_PX - 7 }}
              >
                {hour.format(new Date(2026, 0, 1, h + 1))}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const entries = rows.filter((row) =>
              sameDay(new Date(row.start), day),
            );
            const lanes = lanesOf(entries);
            const isToday = sameDay(day, today);
            const minutesNow = today.getHours() * 60 + today.getMinutes();
            return (
              <div
                key={day.toISOString()}
                role="gridcell"
                className={cn(
                  "relative border-l",
                  isToday && "bg-[#1f5eff]/[0.04]",
                )}
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
                }}
              >
                {entries.map((row) => {
                  const start = new Date(row.start);
                  const end = new Date(row.end);
                  const minutes = start.getHours() * 60 + start.getMinutes();
                  const duration = (end.getTime() - start.getTime()) / 60_000;
                  const lane = lanes.get(row) ?? { lane: 0, of: 1 };
                  return (
                    <DialogTrigger key={`${row.code}:${row.originalStart}`}>
                      <AriaButton
                        className="focus-visible:ring-ring absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-[15px] text-white outline-none focus-visible:ring-2"
                        style={{
                          top: (minutes * HOUR_PX) / 60 + 1,
                          height: Math.max(18, (duration * HOUR_PX) / 60 - 2),
                          left: `calc(${(lane.lane / lane.of) * 100}% + 3px)`,
                          width: `calc(${100 / lane.of}% - 6px)`,
                          background: colorOf(row),
                        }}
                      >
                        <span className="block truncate font-bold">
                          {row.title ?? row.hostName}
                        </span>
                        {duration >= 45 ? (
                          <span className="block truncate opacity-90">
                            {time.formatRange(start, end)}
                          </span>
                        ) : null}
                      </AriaButton>
                      <Popover placement="end top" className={POPOVER}>
                        <MeetingPopover row={row} />
                      </Popover>
                    </DialogTrigger>
                  );
                })}
                {isToday ? (
                  <div
                    role="img"
                    aria-label={t("now", { time: time.format(today) })}
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

/** Phones: a compact month with dots on busy days, and the chosen day's meetings below. */
function PhoneCalendar({
  anchor,
  days,
  rows,
  today,
  onMove,
}: {
  anchor: Date;
  days: Date[];
  rows: OccurrenceRow[];
  today: Date;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = useTranslations("Upcoming");
  const tr = useTranslations("Recurrence");
  const locale = useLocale();
  const [selected, setSelected] = useState(today);
  const busy = (day: Date) =>
    rows.some((row) => sameDay(new Date(row.start), day));
  const chosen = rows.filter((row) => sameDay(new Date(row.start), selected));
  const letter = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const longDay = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="bg-card rounded-2xl p-2.5 ring-1 ring-[#e2e5ea] dark:ring-white/10">
        <div className="flex items-center justify-between">
          <AriaButton
            aria-label={t("previousMonth")}
            onPress={() => onMove(-1)}
            className="focus-visible:ring-ring flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </AriaButton>
          <span className="text-base font-bold">
            {new Intl.DateTimeFormat(locale, {
              month: "long",
              year: "numeric",
            }).format(anchor)}
          </span>
          <AriaButton
            aria-label={t("nextMonth")}
            onPress={() => onMove(1)}
            className="focus-visible:ring-ring flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </AriaButton>
        </div>
        <div className="grid grid-cols-7 text-center">
          {days.slice(0, 7).map((day) => (
            <abbr
              key={day.toISOString()}
              title={longDay.format(day)}
              className="text-muted-foreground py-1 text-xs font-bold no-underline"
            >
              {letter.format(day)}
            </abbr>
          ))}
          {days.map((day) => {
            const isSelected = sameDay(day, selected);
            const has = busy(day);
            return (
              <AriaButton
                key={day.toISOString()}
                aria-pressed={isSelected}
                aria-label={
                  has
                    ? t("dayWithMeetings", { date: label.format(day) })
                    : label.format(day)
                }
                onPress={() => setSelected(day)}
                className={cn(
                  "focus-visible:ring-ring flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[15px] outline-none focus-visible:ring-2",
                  sameDay(day, today) &&
                    !isSelected &&
                    "font-bold ring-2 ring-[#1f5eff] ring-inset",
                  isSelected && "bg-[#1f5eff] text-white",
                  day.getMonth() !== anchor.getMonth() &&
                    !isSelected &&
                    "text-muted-foreground",
                )}
              >
                {day.getDate()}
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-[5px] rounded-full",
                    has
                      ? isSelected
                        ? "bg-white"
                        : "bg-[#1f5eff]"
                      : "bg-transparent",
                  )}
                />
              </AriaButton>
            );
          })}
        </div>
      </div>
      <h2 className="text-muted-foreground text-[15px] font-bold">
        {new Intl.DateTimeFormat(locale, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(selected)}
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
                className="bg-card flex items-center gap-3 rounded-[14px] px-3.5 py-3 ring-1 ring-[#e2e5ea] dark:ring-white/10"
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
                      <span className="inline-flex h-6 items-center gap-1 rounded-xl bg-[#eef1f5] px-2 text-xs font-bold text-[#4f5966] dark:bg-white/10 dark:text-white/70">
                        <Repeat className="size-3.5" aria-hidden="true" />
                        {recurrenceChip(tr, recurrence)}
                      </span>
                    ) : null}
                    <span className="inline-flex h-6 items-center rounded-xl bg-[#e8eeff] px-2 text-xs font-bold text-[#1f5eff] dark:bg-[#1f5eff]/20 dark:text-[#8fb0ff]">
                      {row.role === "host" ? t("host") : t("invitedChip")}
                    </span>
                  </span>
                </div>
                <LinkButton
                  href={`/j/${row.code}${row.passcode ? `#pwd=${row.passcode}` : ""}`}
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

const SEGMENT =
  "data-focus-visible:ring-ring flex h-[34px] cursor-default items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#4f5966] outline-none data-focus-visible:ring-2 data-selected:bg-white data-selected:font-bold data-selected:text-[#12161c] data-selected:shadow-[0_1px_2px_rgba(18,22,28,0.14)] dark:text-white/70 dark:data-selected:bg-white/15 dark:data-selected:text-white";
export const SEGMENTS =
  "flex rounded-[10px] bg-[#eef1f5] p-[3px] ring-1 ring-[#e2e5ea] ring-inset dark:bg-white/5 dark:ring-white/10";
export { SEGMENT };

/** Upcoming's calendar: Month or Week, Today and ‹ ›, on phones a compact month. */
export function UpcomingCalendar() {
  const t = useTranslations("Upcoming");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const now = useNow(60_000);
  const [mode, setMode] = useState<Mode>("month");
  const [picked, setAnchor] = useState<Date | null>(null);
  const anchor = picked ?? dayStart(new Date(now ?? 0));
  const first = weekStartsOn(locale);
  const effective: Mode = isMobile ? "month" : mode;
  const days = daysOf(effective, anchor, first);
  const from = days[0] ?? anchor;
  const to = addDays(days.at(-1) ?? anchor, 1);
  const rows = useOccurrences(from, to) ?? [];
  const today = new Date(now ?? 0);

  function move(direction: -1 | 1) {
    setAnchor(
      effective === "month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
        : addDays(anchor, 7 * direction),
    );
  }

  if (now === null) return null;

  if (isMobile) {
    return (
      <PhoneCalendar
        anchor={anchor}
        days={days}
        rows={rows}
        today={today}
        onMove={move}
      />
    );
  }

  const title =
    effective === "month"
      ? new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
        }).format(anchor)
      : new Intl.DateTimeFormat(locale, {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).formatRange(from, addDays(from, 6));

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            className="h-[38px] rounded-[10px]"
            onPress={() => setAnchor(dayStart(new Date()))}
          >
            {t("todayButton")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              effective === "month" ? t("previousMonth") : t("previousWeek")
            }
            onPress={() => move(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={effective === "month" ? t("nextMonth") : t("nextWeek")}
            onPress={() => move(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <h2 className="ml-1.5 text-[22px] font-bold">{title}</h2>
        </div>
        <RadioGroup
          aria-label={t("range")}
          orientation="horizontal"
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          className={SEGMENTS}
        >
          <Radio value="month" className={SEGMENT}>
            {t("month")}
          </Radio>
          <Radio value="week" className={SEGMENT}>
            {t("week")}
          </Radio>
        </RadioGroup>
      </div>
      {effective === "month" ? (
        <MonthView days={days} anchor={anchor} rows={rows} today={today} />
      ) : (
        <WeekView days={days} rows={rows} now={now} />
      )}
    </div>
  );
}

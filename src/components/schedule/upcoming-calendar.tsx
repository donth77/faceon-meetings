"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Segment, Segments } from "@/components/ui/segments";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNow } from "@/hooks/use-now";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import {
  addDays,
  addMonths,
  dayAsDate,
  dayOf,
  daysOf,
  spanOf,
  type DayKey,
} from "@/lib/calendar-dates";
import {
  occurrencesAction,
  type OccurrenceRow,
} from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import { weekStartsOn } from "@/lib/time";

import { MonthView } from "./calendar/month-view";
import { PhoneCalendar } from "./calendar/phone-calendar";
import { WeekView } from "./calendar/week-view";

const MODES = ["month", "week"] as const;
type Mode = (typeof MODES)[number];

type Occurrences =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; rows: OccurrenceRow[] };

/** The meetings between two moments, fetched when the range changes; failures say so. */
function useOccurrences(
  from: Date,
  to: Date,
): Occurrences & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const key = `${from.toISOString()}|${to.toISOString()}|${attempt}`;
  const [data, setData] = useState<{ key: string; result: Occurrences }>();
  useEffect(() => {
    let cancelled = false;
    const [start = "", end = ""] = key.split("|");
    occurrencesAction(start, end).then(
      (rows) => {
        if (!cancelled) setData({ key, result: { state: "ready", rows } });
      },
      () => {
        if (!cancelled) setData({ key, result: { state: "failed" } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  const result: Occurrences =
    data?.key === key ? data.result : { state: "loading" };
  return { ...result, retry: () => setAttempt((n) => n + 1) };
}

/**
 * Upcoming's calendar: Month or Week, Today and ‹ ›, on phones a compact month. Days
 * and times are in the viewer's time zone (Settings → General).
 */
export function UpcomingCalendar() {
  const t = useTranslations("Upcoming");
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const isMobile = useIsMobile();
  const now = useNow(60_000);
  const [mode, setMode] = useState<Mode>("month");
  const [picked, setAnchor] = useState<DayKey | null>(null);
  const today = dayOf(new Date(now ?? 0), timeZone);
  const anchor = picked ?? today;
  const first = weekStartsOn(locale);
  const effective: Mode = isMobile ? "month" : mode;
  const days = daysOf(effective, anchor, first);
  const span = spanOf(days, timeZone);
  const occurrences = useOccurrences(span.from, span.to);
  const rows = occurrences.state === "ready" ? occurrences.rows : [];
  const loading = occurrences.state === "loading";

  function move(direction: -1 | 1) {
    setAnchor(
      effective === "month"
        ? addMonths(anchor, direction)
        : addDays(anchor, 7 * direction),
    );
  }

  if (now === null) return null;

  const failed =
    occurrences.state === "failed" ? (
      <div
        role="alert"
        className="bg-card ring-border flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-sm ring-1"
      >
        {t("calendarFailed")}
        <Button variant="outline" size="app" onPress={occurrences.retry}>
          {t("retry")}
        </Button>
      </div>
    ) : null;

  if (isMobile) {
    return (
      <div className="flex flex-col gap-3.5" aria-busy={loading}>
        {failed}
        <PhoneCalendar
          anchor={anchor}
          days={days}
          rows={rows}
          today={today}
          timeZone={timeZone}
          onMove={move}
        />
      </div>
    );
  }

  const firstDay = days[0] ?? anchor;
  const title =
    effective === "month"
      ? new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(dayAsDate(anchor))
      : new Intl.DateTimeFormat(locale, {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).formatRange(dayAsDate(firstDay), dayAsDate(addDays(firstDay, 6)));

  return (
    <div className="flex flex-col gap-4.5" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="app" onPress={() => setAnchor(null)}>
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
          {/* Announced when Today, ‹ and › change what's shown. */}
          <h2 aria-live="polite" className="ml-1.5 text-[22px] font-bold">
            {title}
          </h2>
        </div>
        <Segments
          label={t("range")}
          value={mode}
          values={MODES}
          onChange={setMode}
        >
          <Segment value="month">{t("month")}</Segment>
          <Segment value="week">{t("week")}</Segment>
        </Segments>
      </div>
      {failed}
      {effective === "month" ? (
        <MonthView
          days={days}
          anchor={anchor}
          rows={rows}
          today={today}
          timeZone={timeZone}
        />
      ) : (
        <WeekView days={days} rows={rows} now={now} timeZone={timeZone} />
      )}
    </div>
  );
}

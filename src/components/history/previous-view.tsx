"use client";

import { cn } from "cn";
import {
  CalendarPlus,
  Clock3,
  Repeat,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { DownloadButton } from "@/components/exports/download-button";
import { Button, LinkButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segment, Segments } from "@/components/ui/segments";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import type { Attendee, PastMeeting } from "@/lib/meetings/history";
import { useIntlLocale } from "@/lib/preferences";
import {
  formatDay,
  formatDuration,
  formatSpan,
  formatTimeRange,
  isSameDay,
  timeRangeParts,
} from "@/lib/time";

const SHOW = ["all", "hosted"] as const;

/** Someone's avatar, or their initial when there's no picture (a guest before webhooks). */
function PersonAvatar({
  person,
  className,
}: {
  person: Attendee;
  className: string;
}) {
  if (person.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.image}
        alt=""
        className={cn("rounded-full", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-chip text-chip-foreground flex items-center justify-center rounded-full text-xs font-bold",
        className,
      )}
    >
      {[...person.name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** One avatar (or the "+N" past the first four) with a tooltip naming who it is. */
function Named({
  names,
  className,
  children,
}: {
  names: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <TooltipTrigger>
      {/* Not a tab stop of its own: the row's names are on the whole group. */}
      <span
        role="img"
        aria-label={names}
        tabIndex={-1}
        className={cn("flex shrink-0 rounded-full outline-hidden", className)}
      >
        {children}
      </span>
      <Tooltip>{names}</Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Who came: four avatars, then "+N". Pointing at one names it; the group is one tab stop
 * whose focus lists everyone, and screen readers hear the same list as its name.
 */
function Avatars({ people }: { people: Attendee[] }) {
  const t = useTranslations("Previous");
  const list = new Intl.ListFormat(useIntlLocale(), { type: "conjunction" });
  const names = (some: Attendee[]) =>
    list.format(some.map((person) => person.name));
  const shown = people.slice(0, 4);
  const rest = people.slice(4);
  const everyone = names(people);
  return (
    <TooltipTrigger trigger="focus">
      <span
        role="img"
        tabIndex={0}
        aria-label={t("peopleNamed", {
          count: people.length,
          names: everyone,
        })}
        className="focus-visible:focus-ring flex items-center rounded-full outline-hidden"
      >
        {shown.map((person, index) => (
          <Named
            key={`${person.name}-${index}`}
            names={person.name}
            className={cn(index > 0 && "-ml-1")}
          >
            <PersonAvatar
              person={person}
              className="size-7 shrink-0 ring-2 ring-white dark:ring-[#171a1f]"
            />
          </Named>
        ))}
        {rest.length > 0 ? (
          <Named names={names(rest)} className="-ml-1">
            <span className="flex h-7 items-center rounded-full bg-[#eef1f5] px-2 text-xs font-bold ring-2 ring-white dark:bg-white/10 dark:ring-[#171a1f]">
              +{rest.length}
            </span>
          </Named>
        ) : null}
      </span>
      <Tooltip>{everyone}</Tooltip>
    </TooltipTrigger>
  );
}

/** Times, days and lengths in the viewer's time zone (Settings → General). */
function useFormats() {
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return {
    /** For the list, grouped by the day a meeting started (see timeRangeParts). */
    rangeParts: (start: string, end: string) =>
      timeRangeParts(new Date(start), new Date(end), timeZone, locale),
    /** On its own: the day and times, or both days across midnight. */
    span: (start: string, end: string) =>
      formatSpan(new Date(start), new Date(end), timeZone, locale),
    /** Within a meeting's day: the times, with the days only across midnight. */
    range: (start: string, end: string) => {
      const [from, to] = [new Date(start), new Date(end)];
      return isSameDay(from, to, timeZone)
        ? formatTimeRange(from, to, timeZone, locale)
        : formatSpan(from, to, timeZone, locale);
    },
    time: (at: string) => time.format(new Date(at)),
    /** The day of `at` ("Mon, Nov 2") when it's later than the meeting's start. */
    laterDay: (at: string, start: string) =>
      isSameDay(new Date(at), new Date(start), timeZone)
        ? null
        : formatDay(new Date(at), locale, {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone,
          }),
    duration: (minutes: number) => formatDuration(minutes, locale),
    day: (at: string) =>
      formatDay(new Date(at), locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone,
      }),
    date: (at: string) =>
      formatDay(new Date(at), locale, {
        month: "short",
        day: "numeric",
        timeZone,
      }),
  };
}

/**
 * A meeting's times in the list's time column. One that ran past midnight shows its
 * times on one line and the day it ended under them, rather than both full dates.
 */
function TimeRange({
  parts,
}: {
  parts: { times: string; endDay: string | null };
}) {
  const t = useTranslations("Previous");
  return (
    <span className="flex w-[168px] shrink-0 flex-col gap-0.5 font-mono text-sm tabular-nums">
      {parts.times}
      {parts.endDay ? (
        <span className="text-muted-foreground font-sans text-xs">
          {t("endsOn", { day: parts.endDay })}
        </span>
      ) : null}
    </span>
  );
}

/** A time in the attendance table, with its day when it's after the meeting's first. */
function TimeOf({ time, day }: { time: string; day: string | null }) {
  return (
    <>
      {time}
      {day ? (
        <span className="text-muted-foreground block font-sans text-xs">
          {day}
        </span>
      ) : null}
    </>
  );
}

/**
 * The details panel: who came, when they joined and left, and Schedule again. It's a
 * sheet, so focus moves into it, stays there and goes back when it closes.
 */
function Details({ meeting }: { meeting: PastMeeting }) {
  const t = useTranslations("Previous");
  const f = useFormats();
  const locale = useIntlLocale();
  const title = meeting.title ?? t("untitled", { name: meeting.hostName });
  const times = new Intl.ListFormat(locale, { style: "narrow", type: "unit" });

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5 pr-10">
        <SheetTitle className="text-2xl font-bold">{title}</SheetTitle>
        <span className="text-muted-foreground text-[15px]">
          {f.span(meeting.start, meeting.end)} ·{" "}
          {t("hostedBy", { name: meeting.hostName })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip>
          <Clock3 className="size-3.5" aria-hidden="true" />
          {f.duration(meeting.minutes)}
        </Chip>
        <Chip>
          <Users className="size-3.5" aria-hidden="true" />
          {t("people", { count: meeting.attendees.length })}
        </Chip>
        {meeting.notes ? (
          <Chip tone="ai">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {meeting.notes.shared ? t("notesShared") : t("notesSaved")}
          </Chip>
        ) : null}
      </div>
      {/* Times stay on one line; on a phone they're set in the narrower sans face. */}
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left text-base font-bold">
          {t("attendance")}
        </caption>
        <thead>
          <tr className="text-muted-foreground text-xs font-bold tracking-[0.04em] uppercase">
            <th scope="col" className="py-2 text-left">
              {t("name")}
            </th>
            <th scope="col" className="py-2 pl-2 text-right sm:pl-3">
              {t("joined")}
            </th>
            <th scope="col" className="py-2 pl-2 text-right sm:pl-3">
              {t("left")}
            </th>
            <th scope="col" className="py-2 pl-2 text-right sm:pl-3">
              {t("time")}
            </th>
          </tr>
        </thead>
        <tbody>
          {meeting.attendees.map((person, index) => (
            <tr key={`${person.name}-${index}`} className="border-t">
              <th scope="row" className="py-2.5 text-left font-normal">
                <span className="flex items-center gap-2.5">
                  <PersonAvatar
                    person={person}
                    className="size-[26px] shrink-0"
                  />
                  <span className="font-semibold">{person.name}</span>
                  {person.isHost || person.isYou || person.isGuest ? (
                    <span className="text-muted-foreground text-xs font-medium">
                      {person.isHost
                        ? t("host")
                        : person.isYou
                          ? t("you")
                          : t("guest")}
                    </span>
                  ) : null}
                </span>
                {person.visits.length > 1 ? (
                  // Joined and left more than once: the total time is what they were here.
                  <span className="text-muted-foreground mt-1 block pl-9 text-xs leading-normal">
                    {t("visitTimes", {
                      count: person.visits.length,
                      times: times.format(
                        person.visits.map((visit) =>
                          f.range(visit.joinedAt, visit.leftAt),
                        ),
                      ),
                    })}
                  </span>
                ) : null}
              </th>
              <td className="py-2.5 pl-2 text-right text-[13px] whitespace-nowrap tabular-nums sm:pl-3 sm:font-mono">
                <TimeOf
                  time={f.time(person.joinedAt)}
                  day={f.laterDay(person.joinedAt, meeting.start)}
                />
              </td>
              <td className="py-2.5 pl-2 text-right text-[13px] whitespace-nowrap tabular-nums sm:pl-3 sm:font-mono">
                <TimeOf
                  time={f.time(person.leftAt)}
                  day={f.laterDay(person.leftAt, meeting.start)}
                />
              </td>
              <td className="py-2.5 pl-2 text-right text-[13px] whitespace-nowrap tabular-nums sm:pl-3 sm:font-mono">
                {f.duration(person.minutes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
        {meeting.hostedByYou ? (
          // Like Meet's attendance report: for the meeting's host.
          <DownloadButton
            href={`/api/history/${meeting.sessionId}/attendance`}
            fallbackName="attendance.csv"
            className="h-[38px] rounded-[10px]"
          >
            {t("downloadAttendance")}
          </DownloadButton>
        ) : null}
        {meeting.notes ? (
          <LinkButton
            href={`/previous/${meeting.sessionId}/notes`}
            variant="outline"
            className="h-[38px] rounded-[10px]"
          >
            <Sparkles aria-hidden="true" />
            {t("viewNotes")}
          </LinkButton>
        ) : null}
        <LinkButton
          href={`/schedule?again=${meeting.code}`}
          className="h-[38px] rounded-[10px]"
        >
          <CalendarPlus aria-hidden="true" />
          {t("scheduleAgain")}
        </LinkButton>
      </div>
    </>
  );
}

/**
 * Previous: meetings from the last 90 days, by day, searchable by title or person, with
 * attendance in a details panel and Schedule again.
 */
export function PreviousView({ meetings }: { meetings: PastMeeting[] }) {
  const t = useTranslations("Previous");
  const f = useFormats();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<(typeof SHOW)[number]>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const q = query.trim().toLocaleLowerCase();
  const shown = meetings.filter(
    (m) =>
      (show === "all" || m.hostedByYou) &&
      (!q ||
        (m.title ?? "").toLocaleLowerCase().includes(q) ||
        m.hostName.toLocaleLowerCase().includes(q) ||
        m.attendees.some((a) => a.name.toLocaleLowerCase().includes(q))),
  );
  const days = new Map<string, PastMeeting[]>();
  for (const meeting of shown) {
    const day = f.day(meeting.start);
    days.set(day, [...(days.get(day) ?? []), meeting]);
  }
  const open = meetings.find((m) => m.sessionId === selected) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-muted-foreground text-[15px]">{t("subtitle")}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={searchId}
              className="text-muted-foreground text-[13px] font-semibold"
            >
              {t("search")}
            </label>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="bg-card border-input focus-visible:focus-ring h-10 w-60 rounded-[10px] border pr-3 pl-9 text-sm outline-hidden"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span
              id={`${searchId}-show`}
              className="text-muted-foreground text-[13px] font-semibold"
            >
              {t("show")}
            </span>
            <Segments
              labelledBy={`${searchId}-show`}
              value={show}
              values={SHOW}
              onChange={setShow}
            >
              <Segment value="all">{t("all")}</Segment>
              <Segment value="hosted">{t("hostedByMe")}</Segment>
            </Segments>
          </div>
        </div>
      </div>

      {/* Mounted from the start, so a search that finds nothing is announced. */}
      <p role="status" className="sr-only">
        {q && days.size === 0 && meetings.length > 0 ? t("noMatch") : ""}
      </p>
      {days.size === 0 ? (
        <p className="bg-card text-muted-foreground ring-border rounded-2xl p-6 text-sm ring-1">
          {meetings.length === 0 ? t("empty") : t("noMatch")}
        </p>
      ) : (
        [...days.entries()].map(([day, list]) => (
          <section key={day} className="flex flex-col gap-2.5">
            <h2 className="text-muted-foreground text-sm font-bold">{day}</h2>
            <ul className="flex flex-col gap-2.5">
              {list.map((meeting) => {
                const title =
                  meeting.title ?? t("untitled", { name: meeting.hostName });
                return (
                  <li
                    key={meeting.sessionId}
                    className={cn(
                      "bg-card ring-border flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] px-4 py-3.5 ring-1",
                      detailsOpen &&
                        selected === meeting.sessionId &&
                        "bg-chip ring-primary ring-2",
                    )}
                  >
                    <TimeRange
                      parts={f.rangeParts(meeting.start, meeting.end)}
                    />
                    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold">{title}</span>
                        {meeting.recurring ? (
                          <Chip>
                            <Repeat className="size-3.5" aria-hidden="true" />
                            {f.date(meeting.start)}
                          </Chip>
                        ) : null}
                        {meeting.notes ? (
                          <Chip tone="ai">
                            <Sparkles className="size-3.5" aria-hidden="true" />
                            {t("notes")}
                          </Chip>
                        ) : null}
                      </div>
                      <span className="text-muted-foreground flex items-center gap-3 text-[13px]">
                        {f.duration(meeting.minutes)}
                        <Avatars people={meeting.attendees} />
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="app"
                        onPress={() => {
                          setSelected(meeting.sessionId);
                          setDetailsOpen(true);
                        }}
                      >
                        {t("viewDetails")}
                      </Button>
                      <LinkButton
                        href={`/schedule?again=${meeting.code}`}
                        variant="outline"
                        className="h-[38px] rounded-[10px]"
                      >
                        <CalendarPlus aria-hidden="true" />
                        {t("scheduleAgain")}
                      </LinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <Sheet
        isOpen={detailsOpen && open !== null}
        onOpenChange={setDetailsOpen}
        side="right"
        closeLabel={t("closeDetails")}
        className="gap-4.5 overflow-y-auto px-6.5 py-6 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
      >
        {open ? <Details meeting={open} /> : null}
      </Sheet>
    </div>
  );
}

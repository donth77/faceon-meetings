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
import { useId, useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segment, Segments } from "@/components/ui/segments";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import type { Attendee, PastMeeting } from "@/lib/meetings/history";
import { useIntlLocale } from "@/lib/preferences";
import { formatDay } from "@/lib/time";

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
        "flex items-center justify-center rounded-full bg-[#dbe4ff] text-xs font-bold text-[#1f3d99] dark:bg-[#1f5eff]/25 dark:text-[#c9d6ff]",
        className,
      )}
    >
      {[...person.name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}

function Avatars({ people, label }: { people: Attendee[]; label: string }) {
  const shown = people.slice(0, 4);
  return (
    <span role="img" aria-label={label} className="flex items-center">
      {shown.map((person, index) => (
        <PersonAvatar
          key={`${person.name}-${index}`}
          person={person}
          className={cn(
            "size-7 shrink-0 ring-2 ring-white dark:ring-[#171a1f]",
            index > 0 && "-ml-2",
          )}
        />
      ))}
      {people.length > 4 ? (
        <span className="-ml-2 flex h-7 items-center rounded-full bg-[#eef1f5] px-2 text-xs font-bold ring-2 ring-white dark:bg-white/10 dark:ring-[#171a1f]">
          +{people.length - 4}
        </span>
      ) : null}
    </span>
  );
}

/** Times and days in the viewer's time zone (Settings → General). */
function useFormats() {
  const locale = useIntlLocale();
  const timeZone = useViewerTimeZone();
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return {
    range: (start: string, end: string) =>
      time.formatRange(new Date(start), new Date(end)),
    time: (at: string) => time.format(new Date(at)),
    day: (at: string) =>
      formatDay(new Date(at), locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone,
      }),
    shortDay: (at: string) =>
      formatDay(new Date(at), locale, {
        weekday: "short",
        month: "short",
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
          {f.shortDay(meeting.start)} · {f.range(meeting.start, meeting.end)} ·{" "}
          {t("hostedBy", { name: meeting.hostName })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip>
          <Clock3 className="size-3.5" aria-hidden="true" />
          {t("minutes", { count: meeting.minutes })}
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
      <table className="w-full border-collapse">
        <caption className="mb-2 text-left text-base font-bold">
          {t("attendance")}
        </caption>
        <thead>
          <tr className="text-muted-foreground text-xs font-bold tracking-[0.04em] uppercase">
            <th scope="col" className="py-2 text-left">
              {t("name")}
            </th>
            <th scope="col" className="py-2 text-right">
              {t("joined")}
            </th>
            <th scope="col" className="py-2 text-right">
              {t("left")}
            </th>
            <th scope="col" className="py-2 text-right">
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
              <td className="py-2.5 text-right font-mono text-[13px]">
                {f.time(person.joinedAt)}
              </td>
              <td className="py-2.5 text-right font-mono text-[13px]">
                {f.time(person.leftAt)}
              </td>
              <td className="py-2.5 text-right font-mono text-[13px]">
                {t("minutes", { count: person.minutes })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
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
                    <span className="w-[150px] shrink-0 font-mono text-sm tabular-nums">
                      {f.range(meeting.start, meeting.end)}
                    </span>
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
                        {t("minutes", { count: meeting.minutes })}
                        <Avatars
                          people={meeting.attendees}
                          label={t("people", {
                            count: meeting.attendees.length,
                          })}
                        />
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

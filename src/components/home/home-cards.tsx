"use client";

import { CalendarDays, Copy, DoorOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

import { LiveBadge } from "@/components/meetings/live-badge";
import { useScheduledInvitation } from "@/components/schedule/invitation";
import type { UpcomingRow } from "@/components/schedule/upcoming-list";
import { Button, LinkButton } from "@/components/ui/button";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { useNow } from "@/hooks/use-now";
import { useViewerTimeZone } from "@/hooks/use-viewer-time-zone";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { fromRRule } from "@/lib/meetings/describe";
import { worthWatching } from "@/lib/meetings/live";
import { useIntlLocale } from "@/lib/preferences";
import { localParts } from "@/lib/time";

import { useInvitation } from "../meeting/invitation";
import { useMeetingTitle } from "../meeting/meeting-title";

const CARD = "bg-card ring-border flex flex-col gap-3 rounded-2xl p-5.5 ring-1";

function CardIcon({ icon: Icon }: { icon: typeof DoorOpen }) {
  return (
    <span className="bg-chip text-chip-foreground flex size-10 items-center justify-center rounded-xl">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

/**
 * Personal room: the always-available link, with Start and Copy invitation. While it's
 * live (someone's in it), it says so, and Start becomes Join.
 */
export function PersonalRoomCard({
  room,
  live,
}: {
  room: {
    code: string;
    passcode: string | null;
    title: string | null;
    hostName: string;
    waitingRoom: boolean;
  };
  live: boolean;
}) {
  const t = useTranslations("Home");
  const { link, copyInvitation } = useInvitation(room);
  return (
    <section className={CARD}>
      <CardIcon icon={DoorOpen} />
      <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold">
        {t("personalRoom")}
        {live ? <LiveBadge /> : null}
      </h2>
      <span className="font-mono text-lg">{formatMeetingCode(room.code)}</span>
      <p className="text-muted-foreground text-sm">
        {t("personalRoomBody", {
          passcode: room.passcode ? "on" : "off",
          waitingRoom: room.waitingRoom ? "on" : "off",
        })}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <LinkButton href={link} className="h-10 rounded-[10px]">
          {live ? t("join") : t("start")}
        </LinkButton>
        <Button
          variant="outline"
          className="h-10 rounded-[10px]"
          onPress={() => void copyInvitation()}
        >
          <Copy aria-hidden="true" />
          {t("copyInvitation")}
        </Button>
      </div>
    </section>
  );
}

export function ScheduleCard() {
  const t = useTranslations("Home");
  return (
    <section className={CARD}>
      <CardIcon icon={CalendarDays} />
      <h2 className="text-lg font-bold">{t("scheduleTitle")}</h2>
      <p className="text-muted-foreground text-sm">{t("scheduleBody")}</p>
      <LinkButton
        href="/schedule"
        variant="outline"
        className="mt-auto h-10 self-start rounded-[10px]"
      >
        {t("schedule")}
      </LinkButton>
    </section>
  );
}

/**
 * One of your own meetings that's live but has no time on today's list: an instant
 * meeting, say, or one someone carried on with after you left.
 */
export type RunningMeeting = {
  code: string;
  title: string | null;
  hostName: string;
  passcode: string | null;
  allowGuests: boolean;
  /** When its session started (ISO 8601). */
  since: string;
};

function useTimeOfDay() {
  const locale = useIntlLocale();
  const zone = useViewerTimeZone();
  return (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: zone,
    }).format(date);
}

/** A row on Today: its times, its title (and Live), what it is, and its two buttons. */
function TodayItem({
  times,
  title,
  live,
  meta,
  link,
  primary,
  action,
  copyLabel,
  onCopy,
}: {
  times: string[];
  title: ReactNode;
  live: boolean;
  meta: (string | null)[];
  link: string;
  primary: boolean;
  action: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b px-5.5 py-4.5 last:border-b-0">
      <span className="flex w-[5.5rem] shrink-0 flex-col font-mono text-[15px] whitespace-nowrap tabular-nums">
        {times.map((time, index) => (
          <span
            key={index}
            className={index > 0 ? "text-muted-foreground" : undefined}
          >
            {time}
          </span>
        ))}
      </span>
      <div className="flex min-w-[9rem] flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-x-3">
          {title}
          {live ? <LiveBadge /> : null}
        </div>
        <span className="text-muted-foreground truncate text-sm">
          {meta.filter(Boolean).join(" · ")}
        </span>
      </div>
      <LinkButton
        href={link}
        variant={primary ? "default" : "secondary"}
        className="h-10 rounded-[10px]"
      >
        {action}
      </LinkButton>
      <Button
        variant="ghost"
        size="icon"
        aria-label={copyLabel}
        className="size-10"
        onPress={onCopy}
      >
        <Copy aria-hidden="true" />
      </Button>
    </li>
  );
}

function TodayRow({ row }: { row: UpcomingRow }) {
  const t = useTranslations("Home");
  const tu = useTranslations("Upcoming");
  const time = useTimeOfDay();
  const title = row.title ?? tu("untitled", { name: row.hostName });
  const start = new Date(row.start);
  const end = new Date(row.end);
  const invitation = useScheduledInvitation({
    code: row.code,
    passcode: row.passcode,
    hostName: row.hostName,
    title,
    start,
    end,
    timeZone: row.timeZone,
    startDate: row.seriesStartDate,
    recurrence: row.rrule ? fromRRule(row.rrule, row.timeZone) : null,
    invitees: [],
  });
  const isHost = row.role === "host";
  return (
    <TodayItem
      times={[time(start), time(end)]}
      title={
        <Link
          href={`/meetings/${row.code}`}
          className="truncate text-base font-semibold hover:underline"
        >
          {title}
        </Link>
      }
      live={row.live}
      meta={
        isHost
          ? [
              formatMeetingCode(row.code),
              t("youreHost"),
              row.allowGuests ? tu("guestsAllowed") : null,
            ]
          : [
              tu("hostedBy", { name: row.hostName }),
              row.waitingRoom ? tu("waitingRoomOn") : null,
            ]
      }
      link={invitation.link}
      // A live meeting is joined, whoever started it.
      primary={isHost || row.live}
      action={isHost && !row.live ? tu("start") : tu("join")}
      copyLabel={tu("copyInvitation")}
      onCopy={() => void invitation.copyInvitation()}
    />
  );
}

function RunningRow({ meeting }: { meeting: RunningMeeting }) {
  const t = useTranslations("Home");
  const tu = useTranslations("Upcoming");
  const time = useTimeOfDay();
  const title = useMeetingTitle(meeting);
  const { link, copyInvitation } = useInvitation(meeting);
  return (
    <TodayItem
      times={[time(new Date(meeting.since))]}
      title={<span className="truncate text-base font-semibold">{title}</span>}
      live
      meta={[
        formatMeetingCode(meeting.code),
        t("youreHost"),
        meeting.allowGuests ? tu("guestsAllowed") : null,
      ]}
      link={link}
      primary
      action={tu("join")}
      copyLabel={tu("copyInvitation")}
      onCopy={() => void copyInvitation()}
    />
  );
}

/**
 * Today: what's left of today's meetings, in the viewer's time zone, after your own
 * meetings that are live without a time today. A live meeting stays until it ends,
 * however late it runs; the page asks again while anything here is live or due.
 */
export function TodayList({
  rows,
  running,
  roomLive,
}: {
  rows: UpcomingRow[];
  running: RunningMeeting[];
  /** Whether the personal room is live, so the page keeps watching it too. */
  roomLive: boolean;
}) {
  const t = useTranslations("Home");
  const zone = useViewerTimeZone();
  const now = useNow(60_000);
  useLiveRefresh(
    roomLive ||
      running.length > 0 ||
      (now !== null && worthWatching(rows, now)),
  );
  if (now === null) return null;
  const today = localParts(new Date(now), zone).date;
  const todays = rows.filter(
    (row) =>
      row.live ||
      (new Date(row.end).getTime() > now &&
        localParts(new Date(row.start), zone).date === today),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{t("today")}</h2>
        <Link href="/upcoming" className="text-primary text-sm font-semibold">
          {t("seeAllUpcoming")}
        </Link>
      </div>
      {running.length + todays.length > 0 ? (
        <ul className="bg-card rounded-2xl ring-1 ring-[#e2e5ea] dark:ring-white/10">
          {running.map((meeting) => (
            <RunningRow key={meeting.code} meeting={meeting} />
          ))}
          {todays.map((row) => (
            <TodayRow key={`${row.code}:${row.originalStart}`} row={row} />
          ))}
        </ul>
      ) : (
        <p className="bg-card text-muted-foreground rounded-2xl px-5.5 py-4.5 text-sm ring-1 ring-[#e2e5ea] dark:ring-white/10">
          {t("nothingToday")}
        </p>
      )}
    </section>
  );
}

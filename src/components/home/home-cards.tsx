"use client";

import { CalendarDays, Copy, DoorOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useScheduledInvitation } from "@/components/schedule/invitation";
import type { UpcomingRow } from "@/components/schedule/upcoming-list";
import { Button, LinkButton } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { fromRRule } from "@/lib/meetings/describe";
import { useIntlLocale } from "@/lib/preferences";
import { deviceTimeZone, localParts } from "@/lib/time";

import { useInvitation } from "../meeting/invitation";

const CARD =
  "bg-card flex flex-col gap-3 rounded-2xl p-5.5 ring-1 ring-[#e2e5ea] dark:ring-white/10";

function CardIcon({ icon: Icon }: { icon: typeof DoorOpen }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-xl bg-[#e8eeff] text-[#1f5eff] dark:bg-[#1f5eff]/20 dark:text-[#8fb0ff]">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

/** Personal room: the always-available link, with Start and Copy invitation. */
export function PersonalRoomCard({
  room,
}: {
  room: {
    code: string;
    passcode: string | null;
    title: string | null;
    hostName: string;
    waitingRoom: boolean;
  };
}) {
  const t = useTranslations("Home");
  const { link, copyInvitation } = useInvitation(room);
  return (
    <section className={CARD}>
      <CardIcon icon={DoorOpen} />
      <h2 className="text-lg font-bold">{t("personalRoom")}</h2>
      <span className="font-mono text-lg">{formatMeetingCode(room.code)}</span>
      <p className="text-muted-foreground text-sm">
        {t("personalRoomBody", {
          passcode: room.passcode ? "on" : "off",
          waitingRoom: room.waitingRoom ? "on" : "off",
        })}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <LinkButton href={link} className="h-10 rounded-[10px]">
          {t("start")}
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

function TodayRow({ row }: { row: UpcomingRow }) {
  const t = useTranslations("Home");
  const tu = useTranslations("Upcoming");
  const locale = useIntlLocale();
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
  const time = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  const isHost = row.role === "host";
  const meta = isHost
    ? [
        formatMeetingCode(row.code),
        t("youreHost"),
        row.allowGuests ? tu("guestsAllowed") : null,
      ]
    : [
        tu("hostedBy", { name: row.hostName }),
        row.waitingRoom ? tu("waitingRoomOn") : null,
      ];

  return (
    <li className="flex items-center gap-4 border-b px-5.5 py-4.5 last:border-b-0">
      <span className="flex w-[5.5rem] shrink-0 flex-col font-mono text-[15px] whitespace-nowrap tabular-nums">
        <span>{time(start)}</span>
        <span className="text-muted-foreground">{time(end)}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/meetings/${row.code}`}
          className="truncate text-base font-semibold hover:underline"
        >
          {title}
        </Link>
        <span className="text-muted-foreground truncate text-sm">
          {meta.filter(Boolean).join(" · ")}
        </span>
      </div>
      <LinkButton
        href={invitation.link}
        variant={isHost ? "default" : "secondary"}
        className="h-10 rounded-[10px]"
      >
        {isHost ? tu("start") : tu("join")}
      </LinkButton>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tu("copyInvitation")}
        className="size-10"
        onPress={() => void invitation.copyInvitation()}
      >
        <Copy aria-hidden="true" />
      </Button>
    </li>
  );
}

/** Today: what's left of today's meetings, in this device's time zone. */
export function TodayList({ rows }: { rows: UpcomingRow[] }) {
  const t = useTranslations("Home");
  const now = useNow(60_000);
  if (now === null) return null;
  const zone = deviceTimeZone();
  const today = localParts(new Date(now), zone).date;
  const todays = rows.filter(
    (row) =>
      new Date(row.end).getTime() > now &&
      localParts(new Date(row.start), zone).date === today,
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{t("today")}</h2>
        <Link href="/upcoming" className="text-primary text-sm font-semibold">
          {t("seeAllUpcoming")}
        </Link>
      </div>
      {todays.length > 0 ? (
        <ul className="bg-card rounded-2xl ring-1 ring-[#e2e5ea] dark:ring-white/10">
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

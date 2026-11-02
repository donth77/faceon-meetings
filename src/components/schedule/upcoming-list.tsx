"use client";

import { CalendarPlus, Copy, Ellipsis, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, LinkButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNow } from "@/hooks/use-now";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { fromRRule, recurrenceChip } from "@/lib/meetings/describe";
import type { SeriesScope } from "@/lib/meetings/schedule";
import { deleteScheduleAction } from "@/lib/meetings/schedule-actions";
import { useIntlLocale } from "@/lib/preferences";
import {
  deviceTimeZone,
  formatDay,
  formatTimeRange,
  localParts,
  zoneCity,
} from "@/lib/time";

import { useScheduledInvitation } from "./invitation";
import { ScopeDialog } from "./scope-dialog";

/** One meeting in Upcoming, as the server sends it (times in ISO 8601). */
export type UpcomingRow = {
  code: string;
  title: string | null;
  hostName: string;
  role: "host" | "invited";
  start: string;
  end: string;
  originalStart: string;
  moved: boolean;
  rrule: string | null;
  invitedCount: number;
  waitingRoom: boolean;
  allowGuests: boolean;
  passcode: string | null;
  timeZone: string;
  seriesStartDate: string;
};

const CHIP =
  "inline-flex h-6 items-center gap-1 rounded-xl px-2 text-xs font-bold whitespace-nowrap";
const ROLE_CHIP = `${CHIP} bg-[#e8eeff] text-[#1f5eff] dark:bg-[#1f5eff]/20 dark:text-[#8fb0ff]`;
const NEUTRAL_CHIP = `${CHIP} bg-[#eef1f5] text-[#4f5966] dark:bg-white/10 dark:text-white/70`;

function Row({ row }: { row: UpcomingRow }) {
  const t = useTranslations("Upcoming");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const recurrence = row.rrule ? fromRRule(row.rrule, row.timeZone) : null;
  const title = row.title ?? t("untitled", { name: row.hostName });
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
    recurrence,
    invitees: [],
  });
  const isHost = row.role === "host";
  const meta = isHost
    ? [
        formatMeetingCode(row.code),
        row.invitedCount > 0 ? t("invited", { count: row.invitedCount }) : null,
        row.allowGuests ? t("guestsAllowed") : null,
      ]
    : [
        t("hostedBy", { name: row.hostName }),
        row.waitingRoom ? t("waitingRoomOn") : null,
      ];

  async function remove(scope: SeriesScope) {
    setDeleting(false);
    const ok = await deleteScheduleAction(
      row.code,
      scope,
      row.originalStart,
    ).catch(() => false);
    if (ok) {
      toast.success(t("deleted"));
      router.refresh();
    } else {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <li className="bg-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] px-4 py-3.5 ring-1 ring-[#e2e5ea] dark:ring-white/10">
      <span className="w-[150px] shrink-0 font-mono text-sm tabular-nums">
        {formatTimeRange(start, end, deviceTimeZone(), locale)}
      </span>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold">{title}</span>
          {recurrence ? (
            <span className={NEUTRAL_CHIP}>
              <Repeat className="size-3.5" aria-hidden="true" />
              {recurrenceChip(tr, recurrence)}
            </span>
          ) : null}
          <span className={isHost ? ROLE_CHIP : NEUTRAL_CHIP}>
            {isHost ? t("host") : t("invitedChip")}
          </span>
        </div>
        <span className="text-muted-foreground text-[13px]">
          {meta.filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <LinkButton href={invitation.link} className="h-[38px] rounded-[10px]">
          {isHost ? t("start") : t("join")}
        </LinkButton>
        <Button
          variant="outline"
          className="h-[38px] rounded-[10px]"
          onPress={() => void invitation.copyInvitation()}
        >
          <Copy aria-hidden="true" />
          {t("copyInvitation")}
        </Button>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("moreActions", { title })}
            className="size-[38px] rounded-[10px]"
          >
            <Ellipsis aria-hidden="true" />
          </Button>
          <DropdownMenu placement="bottom end" className="min-w-48">
            <DropdownMenuItem
              onAction={() => router.push(`/meetings/${row.code}`)}
            >
              {t("viewDetails")}
            </DropdownMenuItem>
            {isHost ? (
              <DropdownMenuItem
                onAction={() =>
                  router.push(
                    `/meetings/${row.code}/edit${
                      recurrence
                        ? `?occurrence=${encodeURIComponent(row.originalStart)}`
                        : ""
                    }`,
                  )
                }
              >
                {t("edit")}
              </DropdownMenuItem>
            ) : null}
            {isHost ? (
              <DropdownMenuItem
                variant="destructive"
                onAction={() =>
                  recurrence ? setDeleting(true) : void remove("all")
                }
              >
                {t("delete")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenu>
        </DropdownMenuTrigger>
      </div>
      {deleting ? (
        <ScopeDialog
          title={t("deleteSeries")}
          confirm={t("delete")}
          destructive
          onConfirm={(scope) => void remove(scope)}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </li>
  );
}

/**
 * Upcoming, as a list: meetings grouped by day in this device's time zone ("Today ·
 * Sunday, November 1"), each with Start or Join, Copy invitation and more.
 */
export function UpcomingList({ rows }: { rows: UpcomingRow[] }) {
  const t = useTranslations("Upcoming");
  const locale = useIntlLocale();
  const zone = deviceTimeZone();
  const now = useNow(60_000);
  if (now === null) return null;
  const today = localParts(new Date(now), zone).date;
  const tomorrow = localParts(new Date(now + 86_400_000), zone).date;

  const days = new Map<string, UpcomingRow[]>();
  for (const row of rows) {
    if (new Date(row.end).getTime() <= now) continue;
    const day = localParts(new Date(row.start), zone).date;
    days.set(day, [...(days.get(day) ?? []), row]);
  }
  const heading = (day: string, first: UpcomingRow) => {
    const date = formatDay(new Date(first.start), locale, {
      timeZone: zone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (day === today) return t("today", { date });
    if (day === tomorrow) return t("tomorrow", { date });
    return date;
  };

  return (
    <div className="flex flex-col gap-6.5">
      <p className="text-muted-foreground -mt-4 text-[15px]">
        {t("subtitle", { city: zoneCity(zone) })}
      </p>
      {days.size === 0 ? (
        <div className="bg-card flex flex-col items-start gap-3 rounded-2xl p-6 ring-1 ring-[#e2e5ea] dark:ring-white/10">
          <p className="text-[15px] font-semibold">{t("emptyTitle")}</p>
          <p className="text-muted-foreground text-sm">{t("emptyBody")}</p>
          <LinkButton href="/schedule" className="h-[38px] rounded-[10px]">
            <CalendarPlus aria-hidden="true" />
            {t("schedule")}
          </LinkButton>
        </div>
      ) : (
        [...days.entries()].map(([day, list]) => (
          <section key={day} className="flex flex-col gap-2.5">
            <h2 className="text-muted-foreground text-sm font-bold">
              {heading(day, list[0] as UpcomingRow)}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {list.map((row) => (
                <Row key={`${row.code}:${row.originalStart}`} row={row} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

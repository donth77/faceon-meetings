"use client";

import {
  CalendarCheck,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Repeat,
  Trash2,
  Video,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useCalendarProblemToast } from "@/components/google-calendar/outcome";
import { AutoNotesRow } from "@/components/notes/auto-notes-row";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SwitchRow } from "@/components/ui/form-fields";
import { copyText } from "@/lib/clipboard";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { fromRRule } from "@/lib/meetings/describe";
import type { SeriesScope } from "@/lib/meetings/schedule";
import {
  deleteScheduleAction,
  updateScheduledSettingsAction,
} from "@/lib/meetings/schedule-actions";
import type { MeetingDetails } from "@/lib/meetings/scheduling";
import { useIntlLocale } from "@/lib/preferences";
import { formatDay, formatTimeRange, zoneCity, zonedToUtc } from "@/lib/time";

import { useScheduledInvitation } from "./invitation";
import { ScopeDialog } from "./scope-dialog";

const CARD =
  "bg-card flex flex-col gap-3.5 rounded-2xl px-6 py-5.5 ring-1 ring-[#e2e5ea] dark:ring-white/10";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
  actions,
}: {
  label: string;
  value: string;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b py-3 last:border-b-0">
      <span className="text-muted-foreground w-40 shrink-0 text-sm font-semibold">
        {label}
      </span>
      <span className="min-w-0 flex-[1_1_220px] font-mono text-[15px] break-all">
        {value}
      </span>
      <div className="flex gap-1.5">{actions}</div>
    </div>
  );
}

/** A scheduled meeting's page: when it is, how to join, who's invited and its settings. */
export function MeetingDetailsView({
  details,
  viewerEmail,
  aiNotesAllowed,
}: {
  details: MeetingDetails;
  viewerEmail: string;
  /** The host's meetings offer AI notes (Settings → AI notes). */
  aiNotesAllowed: boolean;
}) {
  const t = useTranslations("MeetingDetails");
  const ts = useTranslations("Schedule");
  const tc = useTranslations("GoogleCalendar");
  const locale = useIntlLocale();
  const router = useRouter();
  const showCalendarProblem = useCalendarProblemToast(viewerEmail);
  const [showPasscode, setShowPasscode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settings, setSettings] = useState(details.settings);

  const recurrence = details.rrule
    ? fromRRule(details.rrule, details.timeZone)
    : null;
  const next = details.next[0];
  // With nothing coming up, the invitation describes the series' first meeting.
  const start = next
    ? new Date(next.start)
    : zonedToUtc(`${details.startDate}T${details.startTime}`, details.timeZone);
  const end = next
    ? new Date(next.end)
    : new Date(start.getTime() + details.durationMin * 60_000);
  const invitation = useScheduledInvitation({
    code: details.code,
    passcode: details.passcode,
    hostName: details.hostName,
    title: details.title,
    start,
    end,
    timeZone: details.timeZone,
    startDate: details.startDate,
    recurrence,
    invitees: details.invitees.map((i) => i.email),
    cancelled: details.cancelled.map((d) => new Date(d)),
    moved: details.moved.map((m) => ({
      originalStart: new Date(m.originalStart),
      start: new Date(m.start),
      end: new Date(m.end),
      title: m.title,
    })),
  });
  const city = zoneCity(details.timeZone);
  const longDay = (date: Date) =>
    formatDay(date, locale, {
      timeZone: details.timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  const shortDay = (date: Date) =>
    formatDay(date, locale, {
      timeZone: details.timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const copy = (value: string, done: string) =>
    copyText(value, { copied: done, failed: t("copyFailed") });

  async function changeSetting(key: keyof typeof settings, value: boolean) {
    const previous = settings;
    setSettings({
      ...settings,
      [key]: value,
      ...(key === "waitingRoom" && value ? { joinBeforeHost: false } : {}),
    });
    const ok = await updateScheduledSettingsAction(details.code, {
      [key]: value,
    }).catch(() => false);
    if (!ok) {
      setSettings(previous);
      toast.error(t("saveFailed"));
    }
  }

  async function remove(scope: SeriesScope) {
    setDeleting(false);
    const result = await deleteScheduleAction(
      details.code,
      scope,
      next?.originalStart ?? null,
    ).catch(() => ({ ok: false, calendar: undefined }));
    if (!result.ok) {
      toast.error(t("deleteFailed"));
      return;
    }
    toast.success(t("deleted"), {
      description: result.calendar === "synced" ? tc("removed") : undefined,
    });
    showCalendarProblem(result.calendar, details.code);
    router.push("/upcoming");
    router.refresh();
  }

  const editHref = `/meetings/${details.code}/edit${
    recurrence && next
      ? `?occurrence=${encodeURIComponent(next.originalStart)}`
      : ""
  }`;

  return (
    <div className="flex max-w-[1000px] flex-col gap-5.5">
      <Link
        href="/upcoming"
        className="text-primary flex items-center gap-1 self-start text-sm font-semibold"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("upcoming")}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[34px] font-bold tracking-[-0.01em]">
            {details.title}
          </h1>
          <span className="text-base">
            {next
              ? t("next", {
                  day: longDay(start),
                  time: formatTimeRange(start, end, details.timeZone, locale),
                  city,
                })
              : t("noneUpcoming")}
          </span>
          {invitation.repeats ? (
            <span className="text-muted-foreground flex items-center gap-2 text-[15px]">
              <Repeat className="size-[18px]" aria-hidden="true" />
              {invitation.repeats}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton
            href={invitation.link}
            className="h-[38px] rounded-[10px]"
          >
            <Video aria-hidden="true" />
            {details.isHost ? t("start") : t("join")}
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
            <Button variant="outline" className="h-[38px] rounded-[10px]">
              <CalendarPlus aria-hidden="true" />
              {ts("addToCalendar")}
              <ChevronDown aria-hidden="true" />
            </Button>
            <DropdownMenu className="min-w-60">
              <DropdownMenuItem
                onAction={() =>
                  window.open(invitation.googleLink, "_blank", "noopener")
                }
              >
                <ExternalLink aria-hidden="true" />
                {ts("google")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onAction={() =>
                  window.open(invitation.outlookLink, "_blank", "noopener")
                }
              >
                <ExternalLink aria-hidden="true" />
                {ts("outlook")}
              </DropdownMenuItem>
              <DropdownMenuItem onAction={invitation.downloadIcs}>
                <Download aria-hidden="true" />
                {ts("appleIcs")}
              </DropdownMenuItem>
            </DropdownMenu>
          </DropdownMenuTrigger>
          {details.isHost ? (
            <>
              <LinkButton
                href={editHref}
                variant="outline"
                className="h-[38px] rounded-[10px]"
              >
                <Pencil aria-hidden="true" />
                {t("edit")}
              </LinkButton>
              <Button
                variant="outline"
                className="text-destructive-text hover:text-destructive-text h-[38px] rounded-[10px]"
                onPress={() => setDeleting(true)}
              >
                <Trash2 aria-hidden="true" />
                {t("delete")}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-4">
        <Card title={t("joinDetails")}>
          <div>
            <DetailRow
              label={t("meetingId")}
              value={formatMeetingCode(details.code)}
              actions={
                <Button
                  variant="outline"
                  aria-label={t("copyMeetingId")}
                  onPress={() => void copy(details.code, t("copied"))}
                >
                  <Copy aria-hidden="true" />
                  {t("copy")}
                </Button>
              }
            />
            {details.passcode ? (
              <DetailRow
                label={t("passcode")}
                value={showPasscode ? details.passcode : "••••••"}
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        showPasscode ? t("hidePasscode") : t("showPasscode")
                      }
                      onPress={() => setShowPasscode(!showPasscode)}
                    >
                      {showPasscode ? (
                        <EyeOff aria-hidden="true" />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      aria-label={t("copyPasscode")}
                      onPress={() =>
                        void copy(details.passcode ?? "", t("copied"))
                      }
                    >
                      <Copy aria-hidden="true" />
                      {t("copy")}
                    </Button>
                  </>
                }
              />
            ) : null}
            <DetailRow
              label={t("link")}
              value={invitation.link
                .replace(/^https?:\/\//, "")
                .replace(/#.*$/, "")}
              actions={
                <Button
                  variant="outline"
                  aria-label={t("copyLink")}
                  onPress={() => void invitation.copyLink()}
                >
                  <Copy aria-hidden="true" />
                  {t("copy")}
                </Button>
              }
            />
          </div>
          {recurrence ? (
            <p className="text-muted-foreground text-[13px]">{t("sameLink")}</p>
          ) : null}
        </Card>

        <Card title={t("invited", { count: details.invitees.length })}>
          {details.invitees.length > 0 ? (
            <ul className="flex flex-col">
              {details.invitees.map((person) => (
                <li
                  key={person.email}
                  className="flex items-center gap-2.5 py-2"
                >
                  {person.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.image}
                      alt=""
                      className="size-8 shrink-0 rounded-full"
                    />
                  ) : (
                    <span className="bg-muted size-8 shrink-0 rounded-full" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold">
                      {person.name ?? person.email}
                    </span>
                    {person.name ? (
                      <span className="text-muted-foreground truncate text-[13px]">
                        {person.email}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("nobodyInvited")}
            </p>
          )}
          {details.onGoogleCalendar ? (
            <p className="text-muted-foreground flex items-start gap-2 border-t pt-3 text-[13px] leading-snug">
              <CalendarCheck
                className="text-primary mt-px size-4 shrink-0"
                aria-hidden="true"
              />
              {tc("onCalendarNote")}
            </p>
          ) : null}
        </Card>

        {recurrence ? (
          <Card title={t("nextMeetings")}>
            <ul className="flex flex-col">
              {details.next.map((occurrence) => {
                const s = new Date(occurrence.start);
                const e = new Date(occurrence.end);
                return (
                  <li
                    key={occurrence.originalStart}
                    className="flex justify-between gap-3 border-b py-2.5 text-[15px] last:border-b-0"
                  >
                    <span>{shortDay(s)}</span>
                    <span
                      className={
                        occurrence.moved
                          ? "text-primary font-mono text-sm"
                          : "text-muted-foreground font-mono text-sm"
                      }
                    >
                      {formatTimeRange(s, e, details.timeZone, locale)}
                      {occurrence.moved ? ` · ${t("moved")}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {details.isHost ? (
          <Card title={t("settings")}>
            <div className="flex flex-col divide-y">
              <SwitchRow
                label={ts("waitingRoom")}
                help={t("waitingRoomHelp")}
                isSelected={settings.waitingRoom}
                onChange={(value) => void changeSetting("waitingRoom", value)}
              />
              <SwitchRow
                label={ts("allowGuests")}
                help={ts("allowGuestsHelp")}
                isSelected={settings.allowGuests}
                onChange={(value) => void changeSetting("allowGuests", value)}
              />
              <SwitchRow
                label={ts("muteOnEntry")}
                isSelected={settings.muteOnEntry}
                onChange={(value) => void changeSetting("muteOnEntry", value)}
              />
              <AutoNotesRow
                allowed={aiNotesAllowed}
                isSelected={settings.autoNotes}
                onChange={(value) => void changeSetting("autoNotes", value)}
              />
            </div>
          </Card>
        ) : null}
      </div>

      {deleting && recurrence ? (
        <ScopeDialog
          title={t("deleteSeries")}
          confirm={t("delete")}
          destructive
          onConfirm={(scope) => void remove(scope)}
          onClose={() => setDeleting(false)}
        />
      ) : null}
      <ConfirmDialog
        isOpen={deleting && !recurrence}
        onClose={() => setDeleting(false)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={t("delete")}
        cancelLabel={ts("cancel")}
        destructive
        onConfirm={() => void remove("all")}
      />
    </div>
  );
}

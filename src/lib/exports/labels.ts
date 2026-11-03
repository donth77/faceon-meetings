import "server-only";

import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { publicEnv } from "@/lib/env";
import { KEEP_DAYS } from "@/lib/meetings/retention";
import type { NotesLabels } from "@/lib/notes/notes";

import type { AttendanceLabels } from "./attendance";
import type { MeetingColumnLabels } from "./files";
import type { HistoryLabels } from "./history-files";
import type { YourDataLabels } from "./your-data-files";

/** An attendance file's headings, in the reader's language; times in `timeZone`. */
export async function attendanceLabels(
  locale: Locale,
  timeZone: string,
): Promise<AttendanceLabels> {
  const t = await getTranslations({ locale, namespace: "Exports.attendance" });
  return {
    name: t("name"),
    email: t("email"),
    joinedAs: t("joinedAs"),
    host: t("host"),
    account: t("account"),
    guest: t("guest"),
    firstJoined: t("firstJoined", { zone: timeZone }),
    lastLeft: t("lastLeft", { zone: timeZone }),
    minutes: t("minutes"),
    timesJoined: t("timesJoined"),
  };
}

/** AI notes' Markdown headings and words, as the notes page writes them. */
export async function notesLabels(locale: Locale): Promise<NotesLabels> {
  const t = await getTranslations({ locale, namespace: "Notes" });
  return {
    summary: t("summary"),
    actionItems: t("actionItems"),
    decisions: t("decisions"),
    transcript: t("transcript"),
    noOwner: t("noOwner"),
    due: (when) => t("dueBy", { when }),
    none: t("none"),
  };
}

/** When a meeting was, for its notes' heading: "Monday, November 2, 2026 at 3:00 PM – 3:45 PM". */
export function meetingWhen(locale: Locale, timeZone: string) {
  const day = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  });
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone,
  });
  return (start: string, end: string) =>
    `${day.format(new Date(start))} – ${time.format(new Date(end))}`;
}

/** The day a download was made, written out in the reader's language. */
const downloadedOn = (locale: Locale, timeZone: string, now: Date) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(now);

async function meetingColumns(
  locale: Locale,
  timeZone: string,
): Promise<MeetingColumnLabels> {
  const t = await getTranslations({ locale, namespace: "Exports.previous" });
  return {
    meetingId: t("meetingId"),
    title: t("title"),
    host: t("host"),
    started: t("started", { zone: timeZone }),
  };
}

type Input = {
  locale: Locale;
  timeZone: string;
  reader: { name: string; email: string };
  now: Date;
};

/** Everything "Download your data" says, in the reader's language. */
export async function yourDataLabels(input: Input): Promise<YourDataLabels> {
  const { locale, timeZone } = input;
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const days = KEEP_DAYS.history;
  const [t, tp, attendance, previous, notes] = await Promise.all([
    getTranslations({ locale, namespace: "Exports" }),
    getTranslations({ locale, namespace: "Previous" }),
    attendanceLabels(locale, timeZone),
    meetingColumns(locale, timeZone),
    notesLabels(locale),
  ]);
  const zone = { zone: timeZone };

  return {
    readme: {
      title: t("readme.title", { appName }),
      downloaded: t("readme.downloaded", {
        date: downloadedOn(locale, timeZone, input.now),
        name: input.reader.name,
        email: input.reader.email,
      }),
      inIt: t("readme.inIt"),
      inItItems: [
        t("readme.account"),
        t("readme.hosting"),
        t("readme.meetings"),
        t("readme.previous", { days }),
        t("readme.notes"),
      ],
      notIn: t("readme.notIn"),
      notInItems: [
        t("readme.media", { appName }),
        t("readme.chat", { appName }),
        t("readme.device"),
        t("readme.secrets"),
        t("readme.older", { days }),
      ],
      times: t("readme.times", zone),
    },
    untitled: (name) => tp("untitled", { name }),
    attendance,
    previous,
    meetings: {
      meetingId: t("meetings.meetingId"),
      type: t("meetings.type"),
      title: t("meetings.title"),
      starts: t("meetings.starts", zone),
      minutes: t("meetings.minutes"),
      repeats: t("meetings.repeats"),
      passcode: t("meetings.passcode"),
      waitingRoom: t("meetings.waitingRoom"),
      guestsAllowed: t("meetings.guestsAllowed"),
      invitees: t("meetings.invitees"),
      cohosts: t("meetings.cohosts"),
      yes: t("meetings.yes"),
      no: t("meetings.no"),
      types: {
        instant: t("meetings.instant"),
        scheduled: t("meetings.scheduled"),
        personal: t("meetings.personal"),
      },
    },
    notes,
    when: meetingWhen(locale, timeZone),
  };
}

/** Everything Previous's "Download history" says, in the reader's language. */
export async function historyLabels(input: Input): Promise<HistoryLabels> {
  const { locale, timeZone } = input;
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const days = KEEP_DAYS.history;
  const [t, tp, attendance, meeting, notes] = await Promise.all([
    getTranslations({ locale, namespace: "Exports" }),
    getTranslations({ locale, namespace: "Previous" }),
    attendanceLabels(locale, timeZone),
    meetingColumns(locale, timeZone),
    notesLabels(locale),
  ]);

  return {
    readme: {
      title: t("history.readme.title", { appName }),
      downloaded: t("history.readme.downloaded", {
        date: downloadedOn(locale, timeZone, input.now),
        name: input.reader.name,
      }),
      inIt: t("readme.inIt"),
      inItItems: [
        t("history.readme.history", { days }),
        t("history.readme.attendance"),
        t("history.readme.notes"),
      ],
      notIn: t("readme.notIn"),
      notInItems: [
        t("readme.media", { appName }),
        t("readme.chat", { appName }),
        t("readme.older", { days }),
        t("history.readme.account"),
      ],
      times: t("history.readme.times", { zone: timeZone }),
    },
    untitled: (name) => tp("untitled", { name }),
    history: {
      meetingId: t("history.meetingId"),
      started: t("history.started", { zone: timeZone }),
      title: t("history.title"),
      host: t("history.host"),
      yourRole: t("history.yourRole"),
      minutes: t("history.minutes"),
      people: t("history.people"),
      roles: {
        host: t("history.roles.host"),
        cohost: t("history.roles.cohost"),
        participant: t("history.roles.participant"),
      },
    },
    meeting,
    attendance,
    notes,
    when: meetingWhen(locale, timeZone),
  };
}

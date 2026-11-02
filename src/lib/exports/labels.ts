import "server-only";

import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { publicEnv } from "@/lib/env";
import { KEEP_DAYS } from "@/lib/meetings/retention";

import type { AttendanceLabels } from "./attendance";
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

/** Everything "Download your data" says, in the reader's language. */
export async function yourDataLabels(input: {
  locale: Locale;
  timeZone: string;
  reader: { name: string; email: string };
  now: Date;
}): Promise<YourDataLabels> {
  const { locale, timeZone } = input;
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const days = KEEP_DAYS.history;
  const [t, tn, tp] = await Promise.all([
    getTranslations({ locale, namespace: "Exports" }),
    getTranslations({ locale, namespace: "Notes" }),
    getTranslations({ locale, namespace: "Previous" }),
  ]);
  const zone = { zone: timeZone };
  const day = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  });
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone,
  });

  return {
    readme: {
      title: t("readme.title", { appName }),
      downloaded: t("readme.downloaded", {
        date: day.format(input.now),
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
    attendance: await attendanceLabels(locale, timeZone),
    previous: {
      meetingId: t("previous.meetingId"),
      title: t("previous.title"),
      host: t("previous.host"),
      started: t("previous.started", zone),
    },
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
    notes: {
      summary: tn("summary"),
      actionItems: tn("actionItems"),
      decisions: tn("decisions"),
      transcript: tn("transcript"),
      noOwner: tn("noOwner"),
      due: (when) => tn("dueBy", { when }),
      none: tn("none"),
    },
    when: (start, end) =>
      `${day.format(new Date(start))} – ${time.format(new Date(end))}`,
  };
}

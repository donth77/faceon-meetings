"use client";

import { useTranslations } from "next-intl";

import { useOrigin } from "@/hooks/use-origin";
import { copyText } from "@/lib/clipboard";
import { downloadFile } from "@/lib/download";
import { publicEnv } from "@/lib/env";
import {
  googleCalendarLink,
  icsFile,
  outlookLink,
  type CalendarEvent,
} from "@/lib/meetings/calendar";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { describeRecurrence } from "@/lib/meetings/describe";
import {
  startFacts,
  toRRule,
  type Recurrence,
} from "@/lib/meetings/recurrence";
import {
  loadPreferences,
  useIntlLocale,
  withDefaults,
} from "@/lib/preferences";
import { formatWhen, untilStamp, zoneCity } from "@/lib/time";

import { inviteLink } from "../meeting/invitation";

export type ScheduledMeeting = {
  code: string;
  passcode: string | null;
  hostName: string;
  title: string;
  start: Date;
  end: Date;
  timeZone: string;
  /** The series' local start date, "YYYY-MM-DD", which its repeat rule is worked out from. */
  startDate: string;
  recurrence: Recurrence | null;
  invitees: string[];
  /** Cancelled and moved meetings of a series, for the calendar file. */
  cancelled?: Date[];
  moved?: CalendarEvent["moved"];
};

/**
 * A scheduled meeting's invitation in the reader's language ("Maya is inviting you to a
 * scheduled FaceOn meeting…"), its link, and ways to put it on a calendar.
 */
export function useScheduledInvitation(meeting: ScheduledMeeting) {
  const t = useTranslations("Meeting");
  const tr = useTranslations("Recurrence");
  const locale = useIntlLocale();
  const link = inviteLink(useOrigin(), meeting);
  const when = `${formatWhen(meeting.start, meeting.end, meeting.timeZone, locale)} (${zoneCity(meeting.timeZone)})`;
  const repeats = meeting.recurrence
    ? describeRecurrence(tr, meeting.recurrence, meeting.startDate, locale)
    : null;

  const text = [
    t("invitation.scheduledIntro", {
      host: meeting.hostName,
      appName: publicEnv.NEXT_PUBLIC_APP_NAME,
    }),
    "",
    meeting.title,
    when,
    ...(repeats ? [repeats] : []),
    "",
    t("invitation.join", { link }),
    t("invitation.meetingId", { code: formatMeetingCode(meeting.code) }),
    ...(meeting.passcode
      ? [t("invitation.passcode", { passcode: meeting.passcode })]
      : []),
  ].join("\n");

  const rec = meeting.recurrence;
  const event: CalendarEvent = {
    uid: `${meeting.code}@faceon`,
    title: meeting.title,
    description: text,
    location: link,
    start: meeting.start,
    end: meeting.end,
    timeZone: meeting.timeZone,
    rrule: rec
      ? toRRule(
          rec,
          startFacts(meeting.startDate),
          rec.end.kind === "on"
            ? untilStamp(rec.end.date, meeting.timeZone)
            : null,
        )
      : null,
    invitees: meeting.invitees,
    cancelled: meeting.cancelled,
    moved: meeting.moved,
    // The calendar reminds you as FaceOn would (Settings → Notifications).
    reminderMinutes: withDefaults(loadPreferences()).reminderMinutes,
  };

  const copy = (value: string, done: string, unsaved?: string) =>
    copyText(value, {
      copied: done,
      failed: t("copyFailed"),
      description: unsaved,
    });

  function downloadIcs() {
    downloadFile({
      name: meeting.title,
      extension: "ics",
      content: icsFile(event),
      type: "text/calendar",
    });
  }

  return {
    text,
    link,
    when,
    repeats,
    googleLink: googleCalendarLink(event),
    outlookLink: outlookLink(event),
    downloadIcs,
    copyLink: (unsaved?: string) => copy(link, t("linkCopied"), unsaved),
    copyInvitation: (unsaved?: string) =>
      copy(text, t("invitationCopied"), unsaved),
  };
}

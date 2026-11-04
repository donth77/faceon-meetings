import {
  emailButton,
  emailDetails,
  emailHeading,
  emailLinkFallback,
  emailNote,
  emailPage,
  emailParagraph,
} from "@/lib/email/layout";
import type { Email } from "@/lib/email/send";
import { formatMeetingCode } from "@/lib/meetings/codes";
import { meetingPath } from "@/lib/routes";
import { formatWhen, zoneLabel } from "@/lib/time";

/** The reminder email's sentences (Emails.reminder in the messages files). */
export type ReminderKey =
  | "subject"
  | "heading"
  | "invited"
  | "hosting"
  | "untitled"
  | "topic"
  | "time"
  | "join"
  | "meetingId"
  | "passcode"
  | "why"
  | "stop"
  | "linkFallback";
export type ReminderText = (
  key: ReminderKey,
  values?: Record<string, string>,
) => string;

export type ReminderOccurrence = {
  code: string;
  title: string | null;
  hostName: string;
  role: "host" | "invited";
  start: Date;
  end: Date;
  passcode: string | null;
};

/**
 * "in 10 minutes", "in 1 hour", "in 24 hours": the time left when the email goes, said
 * exactly (a day-based "tomorrow" could be wrong near midnight).
 */
export function timeLeft(start: Date, now: Date, locale: string): string {
  const minutes = Math.max(
    1,
    Math.round((start.getTime() - now.getTime()) / 60_000),
  );
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  return minutes < 60
    ? format.format(minutes, "minute")
    : format.format(Math.round(minutes / 60), "hour");
}

/**
 * A reminder email, as Zoom's invitation reads: the topic, the time in the person's own
 * time zone, Join with the link (the passcode rides in #pwd, never sent to a server),
 * the meeting ID and the passcode. A link at the foot turns reminder emails off, and the
 * List-Unsubscribe headers let mail apps offer the same in one click.
 */
export function reminderEmail(input: {
  to: string;
  occurrence: ReminderOccurrence;
  /** The person's time zone and language. */
  timeZone: string;
  locale: string;
  now: Date;
  siteUrl: string;
  appName: string;
  /** Turns reminder emails off: the page that asks, and the one-click address. */
  stopUrl: string;
  oneClickUrl: string;
  t: ReminderText;
}): Email {
  const { occurrence, t } = input;
  const title =
    occurrence.title?.trim() || t("untitled", { host: occurrence.hostName });
  const when = `${formatWhen(occurrence.start, occurrence.end, input.timeZone, input.locale)}, ${zoneLabel(input.timeZone, input.locale, occurrence.start)}`;
  const link = `${input.siteUrl}${meetingPath(occurrence.code, occurrence.passcode)}`;
  const values = {
    title,
    host: occurrence.hostName,
    appName: input.appName,
    left: timeLeft(occurrence.start, input.now, input.locale),
    when,
    link,
    code: formatMeetingCode(occurrence.code),
    passcode: occurrence.passcode ?? "",
  };
  const heading = t("heading", values);
  const intro = t(occurrence.role === "host" ? "hosting" : "invited", values);
  const details = [
    t("topic", values),
    t("time", values),
    "",
    `${t("join", values)}: ${link}`,
    "",
    t("meetingId", values),
    ...(occurrence.passcode ? [t("passcode", values)] : []),
  ];
  const text = [
    heading,
    intro,
    details.join("\n"),
    `${t("why", values)} ${t("stop", values)}: ${input.stopUrl}`,
  ].join("\n\n");

  const html = emailPage({
    locale: input.locale,
    title: heading,
    preheader: intro,
    appName: input.appName,
    siteUrl: input.siteUrl,
    blocks: [
      emailHeading(heading),
      emailParagraph(intro, 20),
      emailDetails([
        t("topic", values),
        t("time", values),
        t("meetingId", values),
        ...(occurrence.passcode ? [t("passcode", values)] : []),
      ]),
      emailButton(t("join", values), link),
      emailLinkFallback(t("linkFallback", values), link),
      emailNote(t("why", values), {
        label: t("stop", values),
        url: input.stopUrl,
      }),
    ],
  });

  return {
    to: input.to,
    subject: t("subject", values),
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${input.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

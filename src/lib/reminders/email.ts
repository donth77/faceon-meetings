import { BRAND_COLORS } from "@/lib/brand";
import { escapeHtml } from "@/lib/email/html";
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

  const brand = BRAND_COLORS.light;
  const row = (line: string) =>
    `<p style="margin:0 0 6px;font-size:15px;line-height:1.5">${escapeHtml(line)}</p>`;
  const html = `<!doctype html>
<html lang="${escapeHtml(input.locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f5f6f8;color:#12161c;font-family:Figtree,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px;border:1px solid #e2e5ea;border-radius:16px;background:#ffffff">
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:${brand.brand}">${escapeHtml(input.appName)}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(heading)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
<div style="margin:0 0 24px;padding:16px;border-radius:12px;background:#f5f6f8">
${row(t("topic", values))}
${row(t("time", values))}
${row(t("meetingId", values))}
${occurrence.passcode ? row(t("passcode", values)) : ""}
</div>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${brand.brand};color:${brand.brandForeground};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(t("join", values))}</a></p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#4f5966;word-break:break-all">${escapeHtml(t("linkFallback", values))}<br>${escapeHtml(link)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4f5966">${escapeHtml(t("why", values))} <a href="${escapeHtml(input.stopUrl)}" style="color:#4f5966">${escapeHtml(t("stop", values))}</a></p>
</div>
</body>
</html>`;

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

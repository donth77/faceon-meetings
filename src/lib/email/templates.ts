import "server-only";

import { hasLocale, type Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

import type { Email } from "./send";

/**
 * The account emails FaceOn sends: signing up and passwords, and hosting full meetings
 * (to the admins when someone asks, and to the person when an admin answers).
 */
export type AccountEmail =
  | "verify"
  | "reset"
  | "changed"
  | "existing"
  | "hostingAsked"
  | "hostingApproved"
  | "hostingDeclined";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** The person's language when we know it and support it; otherwise the default. */
export function emailLocale(user: object): Locale {
  const locale = "locale" in user ? user.locale : undefined;
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/**
 * One account email, in the person's language: a heading, a sentence, one button (with
 * the link spelled out for clients that hide buttons) and a note on what to do if it
 * wasn't them. Plain text and simple, inline-styled HTML. `values` fill the message's
 * other placeholders; `quote` is someone's own words, shown as they wrote them.
 */
export async function accountEmail(
  kind: AccountEmail,
  input: {
    to: string;
    name: string;
    url: string;
    locale: Locale;
    values?: Record<string, string | number>;
    quote?: string | null;
  },
): Promise<Email> {
  const t = await getTranslations({
    locale: input.locale,
    namespace: "Emails",
  });
  const values = {
    ...input.values,
    appName: publicEnv.NEXT_PUBLIC_APP_NAME,
    name: input.name,
  };
  const heading = t(`${kind}.heading`, values);
  const body = t(`${kind}.body`, values);
  const action = t(`${kind}.action`, values);
  const note = t(`${kind}.note`, values);
  const fallback = t("linkFallback");
  const quote = input.quote?.trim() || null;

  const text = [
    heading,
    body,
    ...(quote ? [`"${quote}"`] : []),
    `${action}: ${input.url}`,
    note,
  ].join("\n\n");
  const html = `<!doctype html>
<html lang="${escapeHtml(input.locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f5f6f8;color:#12161c;font-family:Figtree,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px;border:1px solid #e2e5ea;border-radius:16px;background:#ffffff">
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#1f5eff">${escapeHtml(values.appName)}</p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.5">${escapeHtml(body)}</p>
${quote ? `<blockquote style="margin:0 0 24px;padding:12px 16px;border-radius:10px;background:#f5f6f8;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(quote)}</blockquote>` : ""}
<p style="margin:0 0 24px"><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1f5eff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(action)}</a></p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#4f5966;word-break:break-all">${escapeHtml(fallback)}<br>${escapeHtml(input.url)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#4f5966">${escapeHtml(note)}</p>
</div>
</body>
</html>`;

  return {
    to: input.to,
    subject: t(`${kind}.subject`, values),
    text,
    html,
  };
}

import "server-only";

import { hasLocale, type Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site";

import {
  emailButton,
  emailHeading,
  emailLinkFallback,
  emailNote,
  emailPage,
  emailParagraph,
  emailQuote,
} from "./layout";
import type { Email } from "./send";

/**
 * The account emails FaceOn sends: signing up and passwords, hosting full meetings (to
 * the admins when someone asks, and to the person when an admin answers), and warning
 * the admins when a free allowance runs low (lib/usage/alerts.ts).
 */
export type AccountEmail =
  | "verify"
  | "reset"
  | "changed"
  | "existing"
  | "hostingAsked"
  | "hostingApproved"
  | "hostingDeclined"
  | "usageAlert";

/** The person's language when we know it and support it; otherwise the default. */
export function emailLocale(user: object): Locale {
  const locale = "locale" in user ? user.locale : undefined;
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/**
 * One account email, in the person's language: a heading, a sentence, one button (with
 * the link spelled out for clients that hide buttons) and a note on what to do if it
 * wasn't them, as plain text and in the shared layout (layout.ts). `values` fill the message's
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
  const html = emailPage({
    locale: input.locale,
    title: heading,
    preheader: body,
    appName: values.appName,
    siteUrl: siteUrl(),
    blocks: [
      emailHeading(heading),
      emailParagraph(body),
      ...(quote ? [emailQuote(quote)] : []),
      emailButton(action, input.url),
      emailLinkFallback(fallback, input.url),
      emailNote(note),
    ],
  });

  return {
    to: input.to,
    subject: t(`${kind}.subject`, values),
    text,
    html,
  };
}

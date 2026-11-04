import "server-only";

import { inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { sendEmail, sendInBackground } from "@/lib/email/send";
import { accountEmail, emailLocale } from "@/lib/email/templates";
import { demoTerms, fullTerms } from "@/lib/meetings/hosting";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import { inviteLink } from "./invites";
import { ASK_AGAIN_AFTER_DAYS } from "./rules";

type Person = { name: string; email: string; locale?: string | null };

/**
 * Tells the admins (ADMIN_EMAILS) that someone asked to host full meetings, in each
 * admin's language where they have an account. Sent after the response.
 */
export async function emailAdminsAboutRequest(input: {
  from: Person;
  note: string | null;
}): Promise<void> {
  const admins = serverEnv().ADMIN_EMAILS;
  if (admins.length === 0) return;
  const accounts = await db()
    .select({ email: user.email, locale: user.locale })
    .from(user)
    .where(inArray(sql<string>`lower(${user.email})`, admins));
  for (const address of admins) {
    const account = accounts.find(
      (found) => found.email.toLowerCase() === address,
    );
    sendInBackground(
      accountEmail("hostingAsked", {
        to: address,
        name: input.from.name,
        url: `${siteUrl()}/settings/admin`,
        locale: emailLocale(account ?? {}),
        values: { email: input.from.email },
        quote: input.note,
      }),
    );
  }
}

/** Tells someone an admin approved them: their meetings are full from the next one. */
export function emailApproved(person: Person): void {
  const { people, minutes } = fullTerms();
  sendInBackground(
    accountEmail("hostingApproved", {
      to: person.email,
      name: person.name,
      url: `${siteUrl()}/home`,
      locale: emailLocale(person),
      values: { people, minutes },
    }),
  );
}

/** Tells someone, kindly, that their request wasn't approved, and when they may ask again. */
export function emailDeclined(person: Person): void {
  const { minutes, people } = demoTerms();
  sendInBackground(
    accountEmail("hostingDeclined", {
      to: person.email,
      name: person.name,
      url: `${siteUrl()}/home`,
      locale: emailLocale(person),
      values: { minutes, people, days: ASK_AGAIN_AFTER_DAYS },
    }),
  );
}

/**
 * Invites an approved address to create its account, in the inviting admin's language:
 * who invited them, what full meetings allow, the admin's message, and sign-up with the
 * address filled in. Only when an admin chooses to send it, and it resolves once Resend
 * has it, so the admin hears when it didn't go.
 */
export async function emailInvitation(input: {
  to: string;
  admin: { name: string; locale?: string | null };
  message: string | null;
}): Promise<void> {
  const { people, minutes } = fullTerms();
  await sendEmail(
    await accountEmail("hostInvite", {
      to: input.to,
      name: input.admin.name,
      url: inviteLink(siteUrl(), input.to),
      locale: emailLocale(input.admin),
      values: { admin: input.admin.name, people, minutes },
      quote: input.message,
    }),
  );
}

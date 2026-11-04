import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Locale } from "next-intl";

import { db } from "@/lib/db";
import { usageAlert, user } from "@/lib/db/schema";
import { canSendEmail, sendEmail, type Email } from "@/lib/email/send";
import { accountEmail, emailLocale } from "@/lib/email/templates";
import { reportError } from "@/lib/monitoring/report";
import { serverEnv } from "@/lib/server-env";
import { siteUrl } from "@/lib/site";

import { allProviders } from ".";
import type { MediaProviderId, PermissionsCheck } from "./types";

/** Each provider's name as people know it. */
const PROVIDER_NAMES: Record<MediaProviderId, string> = {
  stream: "Stream",
  livekit: "LiveKit",
};

export type ProviderPermissions = {
  provider: MediaProviderId;
  /** Its name, as people know it. */
  name: string;
  check: PermissionsCheck;
};

/** Every media provider in this deployment, with how its permissions stand. */
export async function mediaPermissions(): Promise<ProviderPermissions[]> {
  return Promise.all(
    allProviders().map(async (provider) => ({
      provider: provider.id,
      name: PROVIDER_NAMES[provider.id],
      check: await provider.checkPermissions(),
    })),
  );
}

/** The warning that went, kept beside the usage warnings until the permissions match again. */
const sentWarning = (provider: MediaProviderId) => ({
  meter: `permissions:${provider}`,
  period: "changed",
  threshold: 100,
});

/** The warning to one admin, with the command that fixes it, linking to Settings → Admin. */
export function permissionsEmail(
  provider: MediaProviderId,
  fix: string,
  to: string,
  locale: Locale,
): Promise<Email> {
  return accountEmail("permissionsChanged", {
    to,
    name: "",
    url: `${siteUrl()}/settings/admin#permissions`,
    locale,
    values: { provider: PROVIDER_NAMES[provider], command: fix },
  });
}

/** Emails the warning to every admin, each in their own language where they have an account. */
async function emailAdmins(provider: MediaProviderId, fix: string) {
  const admins = serverEnv().ADMIN_EMAILS;
  const accounts = await db()
    .select({ email: user.email, locale: user.locale })
    .from(user)
    .where(inArray(sql<string>`lower(${user.email})`, admins));
  for (const address of admins) {
    const account = accounts.find(
      (found) => found.email.toLowerCase() === address,
    );
    await sendEmail(
      await permissionsEmail(
        provider,
        fix,
        address,
        emailLocale(account ?? {}),
      ),
    );
  }
}

/**
 * Tells the admins (ADMIN_EMAILS) when a provider's permissions stop matching FaceOn's
 * setup, from the daily sweep: once, and again only if they're still changed when the
 * warning's record is pruned (KEEP_DAYS.usage). Once they match again it's forgotten, so
 * a later change is told too. It reads only and never puts them back: that's the command
 * the email names. Returns how many warnings went.
 */
export async function warnAboutMediaPermissions(): Promise<number> {
  const env = serverEnv();
  const canEmail = canSendEmail();
  let warned = 0;
  for (const { provider, check } of await mediaPermissions()) {
    const warning = sentWarning(provider);
    const sent = and(
      eq(usageAlert.meter, warning.meter),
      eq(usageAlert.period, warning.period),
    );
    if (check.state === "ok") {
      await db().delete(usageAlert).where(sent);
      continue;
    }
    if (check.state !== "changed" || env.ADMIN_EMAILS.length === 0) continue;
    if (!canEmail) continue;
    // Claimed before it's sent, so two runs at once can't both send it.
    const claimed = await db()
      .insert(usageAlert)
      .values(warning)
      .onConflictDoNothing()
      .returning({ meter: usageAlert.meter });
    if (claimed.length === 0) continue;
    try {
      await emailAdmins(provider, check.fix);
      warned++;
    } catch (error) {
      reportError("A permissions warning failed to send", error);
      await db().delete(usageAlert).where(sent);
    }
  }
  return warned;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import { PanelLoading } from "@/components/app-shell/loading";
import { CalendarSettings } from "@/components/settings/calendar-settings";
import { addonSetup } from "@/lib/addon/google/setup";
import { auth } from "@/lib/auth/server";
import { requireSession } from "@/lib/auth/session";
import { calendarConnection } from "@/lib/google-calendar/connection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Settings");
  return { title: t("section.calendar") };
}

export default function Page({
  searchParams,
}: PageProps<"/[locale]/settings/calendar">) {
  return (
    <Suspense fallback={<PanelLoading height="h-64" />}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Settings → Calendar, for the signed-in user. Google's consent screen comes back here:
 * for Calendar sync `?connected=1` in this page, `?popup=1` in the consent window a form
 * opened; for the add-on `?addon=add` or `?addon=update`; with `?error=` when it failed.
 */
async function Calendar({
  searchParams,
}: Pick<PageProps<"/[locale]/settings/calendar">, "searchParams">) {
  const session = await requireSession("/settings/calendar");
  const { popup, connected, error, addon } = await searchParams;
  const [connection, accounts, setup] = await Promise.all([
    calendarConnection(session.user),
    auth.api.listUserAccounts({ headers: await headers() }),
    addonSetup(session.user.id),
  ]);
  const problem = typeof error === "string" ? error.slice(0, 100) : null;
  const addonAction = addon === "add" || addon === "update" ? addon : null;
  return (
    <CalendarSettings
      connection={connection}
      email={session.user.email}
      googleSignIn={accounts.some(({ providerId }) => providerId === "google")}
      consent={{
        popup: popup === "1",
        returned: connected === "1",
        error: addonAction ? null : problem,
      }}
      addon={setup}
      addonReturn={{
        action: addonAction,
        error: addonAction ? problem : null,
      }}
    />
  );
}

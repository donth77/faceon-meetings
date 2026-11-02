import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";

import { PanelLoading } from "@/components/app-shell/loading";
import { CalendarSettings } from "@/components/settings/calendar-settings";
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
 * `?connected=1` in this page, `?popup=1` in the consent window a form opened, with
 * `?error=` when connecting failed.
 */
async function Calendar({
  searchParams,
}: Pick<PageProps<"/[locale]/settings/calendar">, "searchParams">) {
  const session = await requireSession("/settings/calendar");
  const { popup, connected, error } = await searchParams;
  const [connection, accounts] = await Promise.all([
    calendarConnection(session.user),
    auth.api.listUserAccounts({ headers: await headers() }),
  ]);
  return (
    <CalendarSettings
      connection={connection}
      email={session.user.email}
      googleSignIn={accounts.some(({ providerId }) => providerId === "google")}
      consent={{
        popup: popup === "1",
        returned: connected === "1",
        error: typeof error === "string" ? error.slice(0, 100) : null,
      }}
    />
  );
}

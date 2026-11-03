import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { DesktopCalendar } from "@/components/desktop/desktop-calendar";
import { addonAvailable } from "@/lib/addon/google/available";
import { getSession } from "@/lib/auth/session";
import { calendarConnection } from "@/lib/google-calendar/connection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DesktopCalendar");
  return { title: t("title") };
}

/**
 * Where the desktop app sends people to connect Google Calendar (Google refuses its
 * consent screen inside the app): in their browser, straight on to Google, then back
 * here to say how it went. The app notices the connection by itself. With `?addon=add`
 * (or `update`) it's for FaceOn in Google Calendar and Gmail, and Google comes back to
 * Settings → Calendar in the browser, which adds it and says how to install it.
 */
export default function DesktopCalendarPage({
  searchParams,
}: PageProps<"/[locale]/desktop/calendar">) {
  return (
    <AuthPage links="none">
      <Suspense fallback={<div className="min-h-64" aria-busy="true" />}>
        <Connect searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

async function Connect({
  searchParams,
}: Pick<PageProps<"/[locale]/desktop/calendar">, "searchParams">) {
  const query = await searchParams;
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : "";
  // The app's account; this browser may be signed in to another.
  const account = one(query.for);
  const addon =
    one(query.addon) === "add" || one(query.addon) === "update"
      ? (one(query.addon) as "add" | "update")
      : null;
  const params = new URLSearchParams({
    ...(addon ? { addon } : {}),
    ...(account ? { for: account } : {}),
  }).toString();
  const here = `/desktop/calendar${params ? `?${params}` : ""}`;
  const session = await getSession();
  if (!session) {
    return (
      <DesktopCalendar addon={addon} state={{ step: "signIn", next: here }} />
    );
  }
  if (account && account !== session.user.id) {
    return (
      <DesktopCalendar
        addon={addon}
        state={{ step: "otherAccount", email: session.user.email, next: here }}
      />
    );
  }
  if (addon) {
    return (
      <DesktopCalendar
        addon={addon}
        state={
          addonAvailable()
            ? { step: "start", email: session.user.email }
            : { step: "unavailable" }
        }
      />
    );
  }
  const connection = await calendarConnection(session.user);
  if (connection.status === "unavailable") {
    return <DesktopCalendar addon={null} state={{ step: "unavailable" }} />;
  }
  if (one(query.done)) {
    return (
      <DesktopCalendar
        addon={null}
        state={
          connection.status === "connected"
            ? { step: "connected" }
            : {
                step: "failed",
                email: session.user.email,
                error: one(query.error) || null,
              }
        }
      />
    );
  }
  return (
    <DesktopCalendar
      addon={null}
      state={{ step: "start", email: session.user.email }}
    />
  );
}

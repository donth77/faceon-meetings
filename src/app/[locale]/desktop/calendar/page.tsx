import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AuthPage } from "@/components/auth/auth-page";
import { DesktopCalendar } from "@/components/desktop/desktop-calendar";
import { getSession } from "@/lib/auth/session";
import { calendarConnection } from "@/lib/google-calendar/connection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DesktopCalendar");
  return { title: t("title") };
}

/**
 * Where the desktop app sends people to connect Google Calendar (Google refuses its
 * consent screen inside the app): in their browser, straight on to Google, then back
 * here to say how it went. The app notices the connection by itself.
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
  const here = `/desktop/calendar${account ? `?for=${encodeURIComponent(account)}` : ""}`;
  const session = await getSession();
  if (!session)
    return <DesktopCalendar state={{ step: "signIn", next: here }} />;
  if (account && account !== session.user.id) {
    return (
      <DesktopCalendar
        state={{ step: "otherAccount", email: session.user.email, next: here }}
      />
    );
  }
  const connection = await calendarConnection(session.user);
  if (connection.status === "unavailable") {
    return <DesktopCalendar state={{ step: "unavailable" }} />;
  }
  if (one(query.done)) {
    return (
      <DesktopCalendar
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
    <DesktopCalendar state={{ step: "start", email: session.user.email }} />
  );
}

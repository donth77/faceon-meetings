"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  CALENDAR_SETTINGS_ROUTE,
  connectInPage,
  DESKTOP_CALENDAR_ROUTE,
} from "@/components/google-calendar/connect";
import { ConnectAnyway } from "@/components/google-calendar/different-email";
import { Button, LinkButton } from "@/components/ui/button";
import { signOut } from "@/lib/auth/client";
import { publicEnv } from "@/lib/env";
import {
  connectProblem,
  GOOGLE_SCRIPT_SCOPE,
} from "@/lib/google-calendar/shared";

export type DesktopCalendarState =
  | { step: "signIn"; next: string }
  | { step: "otherAccount"; email: string; next: string }
  | { step: "unavailable" }
  | { step: "start"; email: string }
  | { step: "connected" }
  | { step: "failed"; email: string; error: string | null };

/**
 * /desktop/calendar in the browser: on to Google's consent screen at once, then how it
 * went. Signed out, or signed in to another account than the app's, it says so first.
 * For the add-on (`addon`), Google comes back to Settings → Calendar, which adds it.
 */
export function DesktopCalendar({
  state,
  addon,
}: {
  state: DesktopCalendarState;
  addon: "add" | "update" | null;
}) {
  const t = useTranslations("DesktopCalendar");
  const tc = useTranslations("GoogleCalendar");
  const ta = useTranslations("AddonSetup");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const [problem, setProblem] = useState(false);
  const started = useRef(false);
  const title = addon ? ta("desktopTitle", { appName }) : t("title");

  async function start(email: string) {
    setProblem(false);
    const ok = await connectInPage(
      addon
        ? {
            back: `${CALENDAR_SETTINGS_ROUTE}?addon=${addon}`,
            loginHint: email,
            scope: GOOGLE_SCRIPT_SCOPE,
          }
        : { back: `${DESKTOP_CALENDAR_ROUTE}?done=1`, loginHint: email },
    );
    if (!ok) setProblem(true);
  }

  useEffect(() => {
    if (state.step !== "start" || started.current) return;
    started.current = true;
    void start(state.email);
  }, [state]);

  switch (state.step) {
    case "signIn":
      return (
        <Card title={title}>
          <p>
            {addon
              ? ta("desktopSignIn", { appName })
              : t("signIn", { appName })}
          </p>
          <LinkButton href={`/sign-in?next=${encodeURIComponent(state.next)}`}>
            {t("signInButton")}
          </LinkButton>
        </Card>
      );
    case "otherAccount":
      return (
        <Card title={title}>
          <p>{t("otherAccount", { email: state.email, appName })}</p>
          <Button
            variant="outline"
            onPress={async () => {
              await signOut();
              window.location.assign(
                `/sign-in?next=${encodeURIComponent(state.next)}`,
              );
            }}
          >
            {t("signOut")}
          </Button>
        </Card>
      );
    case "unavailable":
      return (
        <Card title={title}>
          <p>
            {addon
              ? ta("desktopUnavailable", { appName })
              : t("unavailable", { appName })}
          </p>
        </Card>
      );
    case "start":
      return (
        <Card title={title}>
          <p role="status">{problem ? tc("problems.generic") : t("opening")}</p>
          {problem ? (
            <Button onPress={() => void start(state.email)}>
              {t("tryAgain")}
            </Button>
          ) : null}
        </Card>
      );
    case "connected":
      return (
        <Card title={t("connectedTitle")}>
          <p role="status">{t("connectedBody", { appName })}</p>
        </Card>
      );
    case "failed":
      return (
        <Card title={t("failedTitle")}>
          <p role="alert">
            {tc(`problems.${connectProblem(state.error)}`, {
              email: state.email,
              appName,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {connectProblem(state.error) === "emailMismatch" ? (
              <ConnectAnyway
                email={state.email}
                connect={() =>
                  connectInPage({
                    back: `${DESKTOP_CALENDAR_ROUTE}?done=1`,
                    anyAccount: true,
                  })
                }
              />
            ) : null}
            <Button onPress={() => void start(state.email)}>
              {t("tryAgain")}
            </Button>
          </div>
        </Card>
      );
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-card ring-border flex w-full flex-col gap-4 rounded-2xl p-7 text-[15px] leading-normal shadow-sm ring-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </section>
  );
}

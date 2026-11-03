"use client";

import {
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormNotice } from "@/components/auth/fields";
import {
  CALENDAR_SETTINGS_ROUTE,
  connectInBrowser,
  connectInPage,
  reportToOpener,
} from "@/components/google-calendar/connect";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AddonSetup } from "@/lib/addon/google/setup-shared";
import { publicEnv } from "@/lib/env";
import {
  connectProblem,
  type CalendarConnection,
} from "@/lib/google-calendar/shared";

import { AddonSettings, type AddonReturn } from "./addon-settings";
import { ConnectionState, OUTLINE } from "./connection-state";
import { SectionTitle, SettingsCard } from "./settings-nav";

/** Back from Google's consent screen: in the consent window, or in this page. */
export type ConsentReturn = {
  /** This page is the consent window a form opened. */
  popup: boolean;
  /** This page went to Google and came back. */
  returned: boolean;
  /** Google's or Better Auth's error, if connecting failed. */
  error: string | null;
};

/**
 * Settings → Calendar: connect Google Calendar (once), see which account, reconnect
 * when Google asks, or disconnect; and FaceOn in Google Calendar and Gmail, the add-on.
 * Also the page Google's consent window comes back to, which reports to the form that
 * opened it and closes.
 */
export function CalendarSettings({
  connection,
  email,
  googleSignIn,
  consent,
  addon,
  addonReturn,
}: {
  connection: CalendarConnection;
  email: string;
  /** Google is already a way to sign in to this account. */
  googleSignIn: boolean;
  consent: ConsentReturn;
  addon: AddonSetup;
  /** Back from Google's consent screen for the add-on. */
  addonReturn: AddonReturn;
}) {
  const t = useTranslations("Settings.calendar");
  const tc = useTranslations("GoogleCalendar");
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (consent.popup) reportToOpener({ connection, error: consent.error });
  }, [consent.popup, consent.error, connection]);

  if (consent.popup) {
    return (
      <p role="status" className="text-[15px]">
        {connection.status === "connected"
          ? t("popupConnected")
          : t("popupNotConnected")}
      </p>
    );
  }

  async function connect() {
    const inBrowser = connectInBrowser();
    if (inBrowser) {
      toast(tc("inBrowser"));
      if ((await inBrowser)?.connection.status === "connected") {
        toast.success(tc("connected"));
        router.refresh();
      }
      return;
    }
    setConnecting(true);
    const started = await connectInPage({
      back: `${CALENDAR_SETTINGS_ROUTE}?connected=1`,
      loginHint: email,
    });
    if (!started) {
      setConnecting(false);
      toast.error(tc("problems.generic"));
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    const ok = await fetch("/api/integrations/google-calendar", {
      method: "DELETE",
    })
      .then((response) => response.ok)
      .catch(() => false);
    setDisconnecting(false);
    setConfirming(false);
    if (!ok) {
      toast.error(t("disconnectFailed"));
      return;
    }
    toast.success(t("disconnected"));
    router.replace(CALENDAR_SETTINGS_ROUTE);
    router.refresh();
  }

  // Back from Google in this page: say how it went.
  const problem =
    consent.error || (consent.returned && connection.status !== "connected")
      ? connectProblem(consent.error)
      : null;
  const disconnectButton = (
    <Button
      variant="outline"
      className={OUTLINE}
      onPress={() => setConfirming(true)}
    >
      {t("disconnect")}
    </Button>
  );

  return (
    <>
      <SectionTitle title={t("title")} />
      <SettingsCard title={t("google")}>
        {problem ? (
          <FormNotice icon={Info}>
            {tc(`problems.${problem}`, {
              email,
              appName: publicEnv.NEXT_PUBLIC_APP_NAME,
            })}
          </FormNotice>
        ) : consent.returned && connection.status === "connected" ? (
          <FormNotice icon={CircleCheck} role="status">
            {tc("connected")}
          </FormNotice>
        ) : null}
        {connection.status === "unavailable" ? (
          <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
            {t("unavailable")}
          </p>
        ) : null}
        {connection.status === "disconnected" ? (
          <ConnectionState
            icon={<CalendarDays className="size-[22px]" aria-hidden="true" />}
            tone="primary"
            title={t("connectTitle")}
            actions={
              <Button
                className="h-[38px] rounded-[10px]"
                isPending={connecting}
                onPress={() => void connect()}
              >
                {tc("connect")}
              </Button>
            }
          >
            <p>
              {t("connectBody", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
            </p>
            {googleSignIn ? null : <p>{t("alsoSignIn")}</p>}
          </ConnectionState>
        ) : null}
        {connection.status === "connected" ? (
          <ConnectionState
            icon={<CalendarCheck className="size-[22px]" aria-hidden="true" />}
            tone="primary"
            title={tc("connectedAs", { email: connection.email })}
            actions={disconnectButton}
          >
            <p>{t("connectedBody")}</p>
          </ConnectionState>
        ) : null}
        {connection.status === "reconnect" ? (
          <ConnectionState
            icon={<TriangleAlert className="size-[22px]" aria-hidden="true" />}
            tone="warning"
            title={t("reconnectTitle")}
            actions={
              <>
                <Button
                  className="h-[38px] rounded-[10px]"
                  isPending={connecting}
                  onPress={() => void connect()}
                >
                  {tc("reconnect")}
                </Button>
                {disconnectButton}
              </>
            }
          >
            <p>
              {t("reconnectBody", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
            </p>
          </ConnectionState>
        ) : null}
        {connection.status !== "unavailable" ? (
          <p className="text-muted-foreground text-[13px] leading-snug">
            {t("otherCalendars")}
          </p>
        ) : null}
      </SettingsCard>
      <AddonSettings initial={addon} email={email} returned={addonReturn} />
      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={t("disconnectTitle")}
        description={t("disconnectBody", {
          appName: publicEnv.NEXT_PUBLIC_APP_NAME,
        })}
        confirmLabel={t("disconnect")}
        cancelLabel={t("cancel")}
        isPending={disconnecting}
        onConfirm={() => void disconnect()}
      />
    </>
  );
}

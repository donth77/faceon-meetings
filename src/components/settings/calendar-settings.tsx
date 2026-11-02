"use client";

import { cn } from "cn";
import {
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { FormNotice } from "@/components/auth/fields";
import {
  CALENDAR_SETTINGS_ROUTE,
  connectInPage,
  reportToOpener,
} from "@/components/google-calendar/connect";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { publicEnv } from "@/lib/env";
import {
  connectProblem,
  type CalendarConnection,
} from "@/lib/google-calendar/shared";

import { SectionTitle, SettingsCard } from "./settings-nav";

const OUTLINE =
  "h-[38px] rounded-[10px] border-[#c9cfd8] px-3.5 text-sm font-semibold dark:border-white/15";

/** Back from Google's consent screen: in the consent window, or in this page. */
export type ConsentReturn = {
  /** This page is the consent window a form opened. */
  popup: boolean;
  /** This page went to Google and came back. */
  returned: boolean;
  /** Google's or Better Auth's error, if connecting failed. */
  error: string | null;
};

function ConnectionState({
  icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  tone: "primary" | "warning";
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
        )}
      >
        {icon}
      </span>
      <span className="text-[17px] leading-snug font-bold">{title}</span>
      <div className="text-muted-foreground flex max-w-[64ch] flex-col gap-1.5 text-sm leading-normal">
        {children}
      </div>
      <div className="mt-1 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

/**
 * Settings → Calendar: connect Google Calendar (once), see which account, reconnect
 * when Google asks, or disconnect. Also the page Google's consent window comes back
 * to, which reports to the form that opened it and closes.
 */
export function CalendarSettings({
  connection,
  email,
  googleSignIn,
  consent,
}: {
  connection: CalendarConnection;
  email: string;
  /** Google is already a way to sign in to this account. */
  googleSignIn: boolean;
  consent: ConsentReturn;
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

"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SelectField, SwitchRow } from "@/components/ui/form-fields";
import { useCapability } from "@/hooks/use-capability";
import { publicEnv } from "@/lib/env";
import {
  chosenSettings,
  REMINDER_MINUTES,
  setPreference,
  usePreferences,
} from "@/lib/preferences";
import { setEmailRemindersAction } from "@/lib/reminders/actions";
import { EMAIL_REMINDER_MINUTES } from "@/lib/reminders/rules";
import { viewerTimeZone } from "@/lib/time";

import { SectionTitle, SettingsCard } from "./settings-nav";

const SOUNDS = [
  "soundPeople",
  "soundChat",
  "soundHands",
  "soundLobby",
] as const;
const POPUPS = ["popupChat", "popupHands", "popupLobby"] as const;
type Switch = (typeof SOUNDS)[number] | (typeof POPUPS)[number];

/** The account's email reminders, as the Settings page reads them: 0 is off. */
export type EmailRemindersSetting = { minutes: number; email: string };

/**
 * Settings → Notifications, as in Meet: which events make a sound, and which show a
 * pop-up. Everything is on to start; reactions have their own section. One switch
 * pauses them all and keeps each choice, which shows (unavailable) until it's back on.
 * On the Settings page (not in a meeting), email reminders too, which are the account's.
 */
export function NotificationsSettings({
  emailReminders,
}: {
  emailReminders?: EmailRemindersSetting | undefined;
}) {
  const t = useTranslations("Settings.notifications");
  const settings = chosenSettings(usePreferences());
  const paused = !settings.notifications;
  const row = (key: Switch) => (
    <SwitchRow
      key={key}
      label={t(`${key}.label`)}
      help={t(`${key}.help`)}
      isSelected={settings[key]}
      isDisabled={paused}
      onChange={(on) => setPreference(key, on)}
    />
  );
  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      <SettingsCard title={t("allTitle")}>
        <SwitchRow
          label={t("all")}
          help={t("allHelp")}
          isSelected={settings.notifications}
          onChange={(on) => setPreference("notifications", on)}
        />
      </SettingsCard>
      <SettingsCard title={t("sounds")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          {SOUNDS.map(row)}
        </div>
      </SettingsCard>
      <Reminders paused={paused} />
      {emailReminders ? <EmailReminders {...emailReminders} /> : null}
      <SettingsCard title={t("popups")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          {POPUPS.map(row)}
        </div>
      </SettingsCard>
    </>
  );
}

type Permission = NotificationPermission | "unsupported";

const permissionNow = (): Permission =>
  typeof Notification === "undefined" ? "unsupported" : Notification.permission;

/**
 * When to be reminded of a meeting, and whether this browser may show it. While
 * Notifications are paused, the choice shows but can't change, and nothing asks.
 */
function Reminders({ paused }: { paused: boolean }) {
  const t = useTranslations("Settings.notifications.reminders");
  const { reminderMinutes } = chosenSettings(usePreferences());
  const [permission, setPermission] = useState<Permission>(permissionNow);
  // iPhone and iPad show notifications only from an app on the Home Screen.
  const onceInstalled = useCapability("notificationsOnceInstalled");

  async function allow() {
    if (permission !== "default") return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <SettingsCard title={t("title")}>
      <div className="flex max-w-[440px] flex-col gap-1.5">
        <SelectField
          label={t("label")}
          options={REMINDER_MINUTES.map((minutes) => ({
            id: String(minutes),
            label: minutes === 0 ? t("off") : t("before", { minutes }),
          }))}
          value={String(reminderMinutes)}
          isDisabled={paused}
          onChange={(value) => {
            const minutes =
              REMINDER_MINUTES.find((m) => String(m) === value) ?? 5;
            setPreference("reminderMinutes", minutes);
            // Choosing a reminder is a good moment to ask for notifications.
            if (minutes > 0) void allow();
          }}
        />
        <span className="text-muted-foreground text-[13px]">
          {t("help", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
        </span>
      </div>
      {reminderMinutes > 0 && !paused ? (
        permission === "default" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              {t("askBody", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
            </span>
            <Button
              variant="outline"
              className="h-9 rounded-[10px]"
              onPress={() => void allow()}
            >
              {t("allow")}
            </Button>
          </div>
        ) : permission === "denied" ? (
          <p className="text-muted-foreground text-sm">
            {t("blocked", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
          </p>
        ) : permission === "granted" ? (
          <p className="text-muted-foreground text-sm">{t("allowed")}</p>
        ) : onceInstalled ? (
          <p className="text-muted-foreground text-sm">
            {t.rich("homeScreen", {
              appName: publicEnv.NEXT_PUBLIC_APP_NAME,
              link: (chunks) => (
                <Link
                  href="/help/install-the-app"
                  className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : null
      ) : null}
    </SettingsCard>
  );
}

/**
 * Email reminders: the account's, sent by the server before meetings you host or are
 * invited to, so they come wherever you are. Off to start; the time zone they give times
 * in is this device's, saved with the choice.
 */
function EmailReminders({ minutes, email }: EmailRemindersSetting) {
  const t = useTranslations("Settings.notifications.email");
  const [chosen, setChosen] = useState(minutes);

  async function choose(next: number) {
    const before = chosen;
    setChosen(next);
    const saved = await setEmailRemindersAction({
      minutes: next,
      timeZone: viewerTimeZone(),
    }).catch(() => false);
    if (!saved) {
      setChosen(before);
      toast.error(t("saveFailed"));
    }
  }

  return (
    <SettingsCard title={t("title")}>
      <div className="flex max-w-[440px] flex-col gap-1.5">
        <SelectField
          label={t("label")}
          options={[0, ...EMAIL_REMINDER_MINUTES].map((value) => ({
            id: String(value),
            label:
              value === 0 ? t("off") : t("before", { minutes: String(value) }),
          }))}
          value={String(chosen)}
          onChange={(value) => void choose(Number(value))}
        />
        <span className="text-muted-foreground text-[13px]">
          {t("help", { email })}
        </span>
      </div>
    </SettingsCard>
  );
}

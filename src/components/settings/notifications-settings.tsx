"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { SelectField, SwitchRow } from "@/components/schedule/fields";
import { Button } from "@/components/ui/button";
import {
  REMINDER_MINUTES,
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { SectionTitle, SettingsCard } from "./settings-nav";

const SOUNDS = [
  "soundPeople",
  "soundChat",
  "soundHands",
  "soundLobby",
] as const;
const POPUPS = ["popupChat", "popupHands", "popupLobby"] as const;
type Switch = (typeof SOUNDS)[number] | (typeof POPUPS)[number];

/**
 * Settings → Notifications, as in Meet: which events make a sound, and which show a
 * pop-up. Everything is on to start; reactions have their own section.
 */
export function NotificationsSettings() {
  const t = useTranslations("Settings.notifications");
  const settings = withDefaults(usePreferences());
  const row = (key: Switch) => (
    <SwitchRow
      key={key}
      label={t(`${key}.label`)}
      help={t(`${key}.help`)}
      isSelected={settings[key]}
      onChange={(on) => savePreferences({ [key]: on ? undefined : false })}
    />
  );
  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      <SettingsCard title={t("sounds")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          {SOUNDS.map(row)}
        </div>
      </SettingsCard>
      <Reminders />
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

/** When to be reminded of a meeting, and whether this browser may show it. */
function Reminders() {
  const t = useTranslations("Settings.notifications.reminders");
  const { reminderMinutes } = withDefaults(usePreferences());
  const [permission, setPermission] = useState<Permission>(permissionNow);

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
          onChange={(value) => {
            const minutes =
              REMINDER_MINUTES.find((m) => String(m) === value) ?? 5;
            savePreferences({
              reminderMinutes: minutes === 5 ? undefined : minutes,
            });
            // Choosing a reminder is a good moment to ask for notifications.
            if (minutes > 0) void allow();
          }}
        />
        <span className="text-muted-foreground text-[13px]">{t("help")}</span>
      </div>
      {reminderMinutes > 0 ? (
        permission === "default" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{t("askBody")}</span>
            <Button
              variant="outline"
              className="h-9 rounded-[10px]"
              onPress={() => void allow()}
            >
              {t("allow")}
            </Button>
          </div>
        ) : permission === "denied" ? (
          <p className="text-muted-foreground text-sm">{t("blocked")}</p>
        ) : permission === "granted" ? (
          <p className="text-muted-foreground text-sm">{t("allowed")}</p>
        ) : null
      ) : null}
    </SettingsCard>
  );
}

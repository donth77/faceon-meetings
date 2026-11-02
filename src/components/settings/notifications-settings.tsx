"use client";

import { useTranslations } from "next-intl";

import { SwitchRow } from "@/components/schedule/fields";
import {
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
      <SettingsCard title={t("popups")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          {POPUPS.map(row)}
        </div>
      </SettingsCard>
    </>
  );
}

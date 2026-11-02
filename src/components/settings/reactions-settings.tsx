"use client";

import { useTranslations } from "next-intl";

import { SelectField, SwitchRow } from "@/components/ui/form-fields";
import {
  chosenSettings,
  setPreference,
  usePreferences,
} from "@/lib/preferences";

import { SectionTitle, SettingsCard } from "./settings-nav";

const ANNOUNCE = ["off", "summary", "each"] as const;

/**
 * Settings → Reactions, as in Meet: whose reactions show, whether they move, whether they
 * make a sound, and what screen readers hear about them.
 */
export function ReactionsSettings() {
  const t = useTranslations("Settings.reactions");
  const {
    showOthersReactions,
    reactionAnimation,
    reactionSound,
    reactionAnnouncements,
    notifications,
  } = chosenSettings(usePreferences());

  return (
    <>
      <SectionTitle title={t("title")} />
      <SettingsCard title={t("onScreen")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          <SwitchRow
            label={t("showOthers")}
            help={t("showOthersHelp")}
            isSelected={showOthersReactions}
            onChange={(on) => setPreference("showOthersReactions", on)}
          />
          <SwitchRow
            label={t("animation")}
            help={t("animationHelp")}
            isSelected={reactionAnimation}
            onChange={(on) => setPreference("reactionAnimation", on)}
          />
          <SwitchRow
            label={t("sound")}
            help={notifications ? t("soundHelp") : t("soundPaused")}
            isSelected={reactionSound}
            isDisabled={!notifications}
            onChange={(on) => setPreference("reactionSound", on)}
          />
        </div>
      </SettingsCard>
      <SettingsCard title={t("screenReaders")}>
        <div className="flex max-w-[440px] flex-col gap-1.5">
          <SelectField
            label={t("announce")}
            options={ANNOUNCE.map((id) => ({
              id,
              label: t(`announceOptions.${id}`),
            }))}
            value={reactionAnnouncements}
            onChange={(value) => {
              const mode = ANNOUNCE.find((id) => id === value) ?? "summary";
              setPreference("reactionAnnouncements", mode);
            }}
          />
          <span className="text-muted-foreground text-[13px]">
            {t("announceHelp")}
          </span>
        </div>
      </SettingsCard>
    </>
  );
}

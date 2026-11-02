"use client";

import { useTranslations } from "next-intl";

import { SelectField, SwitchRow } from "@/components/schedule/fields";
import {
  savePreferences,
  usePreferences,
  withDefaults,
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
  } = withDefaults(usePreferences());

  return (
    <>
      <SectionTitle title={t("title")} />
      <SettingsCard title={t("onScreen")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          <SwitchRow
            label={t("showOthers")}
            help={t("showOthersHelp")}
            isSelected={showOthersReactions}
            onChange={(on) =>
              savePreferences({ showOthersReactions: on ? undefined : false })
            }
          />
          <SwitchRow
            label={t("animation")}
            help={t("animationHelp")}
            isSelected={reactionAnimation}
            onChange={(on) =>
              savePreferences({ reactionAnimation: on ? undefined : false })
            }
          />
          <SwitchRow
            label={t("sound")}
            help={t("soundHelp")}
            isSelected={reactionSound}
            onChange={(on) =>
              savePreferences({ reactionSound: on ? true : undefined })
            }
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
              savePreferences({
                reactionAnnouncements: mode === "summary" ? undefined : mode,
              });
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

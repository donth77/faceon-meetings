"use client";

import { useTranslations } from "next-intl";
import { use } from "react";

import { SwitchRow } from "@/components/schedule/fields";
import { ShortcutsList } from "@/components/shortcuts/shortcuts-list";
import {
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { SectionTitle, SettingsCard, SettingsChrome } from "./settings-nav";

/**
 * Settings → Accessibility: only what the device can't tell us (reduced motion, contrast
 * and text size follow the device's own settings), and the keyboard shortcuts, listed
 * right here; ? and the menus still open them in their own dialog.
 */
export function AccessibilitySettings() {
  const t = useTranslations("Settings.accessibility");
  const ts = useTranslations("Shortcuts");
  const chrome = use(SettingsChrome);
  const { singleKeyShortcuts } = withDefaults(usePreferences());

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      <SettingsCard title={t("shortcuts")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          <SwitchRow
            label={t("singleKeys")}
            help={t("singleKeysHelp")}
            isSelected={singleKeyShortcuts}
            onChange={(on) =>
              savePreferences({ singleKeyShortcuts: on ? undefined : false })
            }
          />
        </div>
        <p className="text-muted-foreground text-sm">{ts("description")}</p>
        <ShortcutsList headingLevel={chrome === "dialog" ? 4 : 3} />
      </SettingsCard>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { ShortcutsList } from "@/components/shortcuts/shortcuts-list";
import { SwitchRow } from "@/components/ui/form-fields";
import { setPreference, usePreferences, withDefaults } from "@/lib/preferences";

import { SectionTitle, SettingsCard } from "./settings-nav";

/**
 * Settings → Accessibility: only what the device can't tell us (reduced motion, contrast
 * and text size follow the device's own settings), and the keyboard shortcuts, listed
 * right here; ? and the menus still open them in their own dialog.
 */
export function AccessibilitySettings() {
  const t = useTranslations("Settings.accessibility");
  const ts = useTranslations("Shortcuts");
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
            onChange={(on) => setPreference("singleKeyShortcuts", on)}
          />
        </div>
        <p className="text-muted-foreground text-sm">{ts("description")}</p>
        {/* The card's heading is an h3, on the page and in the meeting's dialog. */}
        <ShortcutsList headingLevel={4} />
      </SettingsCard>
    </>
  );
}

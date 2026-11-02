"use client";

import { Keyboard } from "lucide-react";
import { useTranslations } from "next-intl";

import { SwitchRow } from "@/components/schedule/fields";
import { useOpenShortcuts } from "@/components/shortcuts/shortcuts-dialog";
import { Button } from "@/components/ui/button";
import { isAppleDevice } from "@/lib/platform";
import {
  savePreferences,
  usePreferences,
  withDefaults,
} from "@/lib/preferences";

import { SectionTitle, SettingsCard } from "./settings-nav";

/**
 * Settings → Accessibility: only what the device can't tell us. Reduced motion, contrast
 * and text size follow the device's own settings.
 */
export function AccessibilitySettings() {
  const t = useTranslations("Settings.accessibility");
  const openShortcuts = useOpenShortcuts();
  const { singleKeyShortcuts, announceReactions } =
    withDefaults(usePreferences());
  // Without single-key shortcuts, ? does nothing; Ctrl+/ or ⌘/ still opens the list.
  const key = singleKeyShortcuts ? "?" : isAppleDevice() ? "⌘/" : "Ctrl+/";

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro")} />
      <SettingsCard title={t("keyboard")}>
        <div className="divide-y divide-[#e2e5ea] dark:divide-white/10">
          <SwitchRow
            label={t("singleKeys")}
            help={t("singleKeysHelp")}
            isSelected={singleKeyShortcuts}
            onChange={(on) =>
              savePreferences({ singleKeyShortcuts: on ? undefined : false })
            }
          />
          <SwitchRow
            label={t("announceReactions")}
            help={t("announceReactionsHelp")}
            isSelected={announceReactions}
            onChange={(on) =>
              savePreferences({ announceReactions: on ? undefined : false })
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-[38px] gap-2 rounded-[10px] border-[#c9cfd8] px-3.5 text-sm font-semibold dark:border-white/15"
            onPress={openShortcuts}
          >
            <Keyboard className="size-[18px]" aria-hidden="true" />
            {t("shortcuts")}
          </Button>
          <span className="text-muted-foreground text-[13px]">
            {t.rich("orPress", {
              key,
              kbd: (chunks) => (
                <kbd className="bg-muted text-foreground rounded-[5px] border px-1.5 py-px font-sans text-xs font-semibold">
                  {chunks}
                </kbd>
              ),
            })}
          </span>
        </div>
      </SettingsCard>
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";

import { RadioDot } from "@/components/ui/form-fields";
import {
  markDesktopAppKnown,
  useDesktopAppKnown,
} from "@/lib/desktop/app-known";
import { DESKTOP_LINKS, type DesktopLinks } from "@/lib/desktop/open-in-app";
import { useDesktop, useIsComputer } from "@/lib/desktop/use-desktop";
import { publicEnv } from "@/lib/env";
import {
  loadPreferences,
  savePreferences,
  subscribePreferences,
  withDefaults,
  type Preferences,
} from "@/lib/preferences";

import { SettingsCard } from "./settings-nav";

const NONE: Preferences = {};

/**
 * Settings → General, in a browser on a computer that knows the desktop app is here
 * (it signed the app in): what meeting links do. Ask each time (the default), Always,
 * or Never. It belongs to this browser, like the rest of these settings.
 */
export function DesktopLinksSetting() {
  const t = useTranslations("Settings.general.desktopLinks");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const inApp = useDesktop() !== null;
  const known = useDesktopAppKnown();
  const computer = useIsComputer();
  const preferences = useSyncExternalStore(
    subscribePreferences,
    loadPreferences,
    () => NONE,
  );
  // The app's Settings → Desktop app opens this page with #desktop-app: this browser is
  // on the same computer as the app.
  useEffect(() => {
    if (window.location.hash !== "#desktop-app") return;
    markDesktopAppKnown();
    requestAnimationFrame(() =>
      document
        .getElementById("desktop-app")
        ?.scrollIntoView({ block: "center" }),
    );
  }, []);
  if (inApp || !known || !computer) return null;
  return (
    <SettingsCard title={t("title")} id="desktop-app">
      <RadioGroup
        value={withDefaults(preferences).desktopLinks}
        onChange={(value) =>
          savePreferences({ desktopLinks: value as DesktopLinks })
        }
        className="flex flex-col"
      >
        <Label className="mb-1 text-sm font-semibold">
          {t("label", { appName })}
        </Label>
        {DESKTOP_LINKS.map((value) => (
          <Radio
            key={value}
            value={value}
            className="group flex items-start gap-3 py-2 text-[15px] font-semibold outline-none"
          >
            <RadioDot className="mt-0.5" />
            {t(value)}
          </Radio>
        ))}
      </RadioGroup>
    </SettingsCard>
  );
}

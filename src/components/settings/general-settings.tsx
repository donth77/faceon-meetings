"use client";

import { cn } from "cn";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Label, Radio, RadioGroup } from "react-aria-components";

import { SelectField } from "@/components/schedule/fields";
import { TimeZoneField } from "@/components/schedule/time-zone-field";
import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import {
  savePreferences,
  useIntlLocale,
  usePreferences,
} from "@/lib/preferences";
import { systemTimeZone } from "@/lib/time";

import { SettingsCard } from "./settings-nav";

const ONE_YEAR = 60 * 60 * 24 * 365;

const nativeName = (locale: string) =>
  new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;

function RadioDot() {
  return (
    <span
      aria-hidden="true"
      className="group-data-focus-visible:ring-ring mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-[#c9cfd8] group-data-focus-visible:ring-2 group-data-selected:border-[#1f5eff] dark:border-white/30"
    >
      <span className="hidden size-2 rounded-full bg-[#1f5eff] group-data-selected:block" />
    </span>
  );
}

/** A small picture of the app in a theme, for the Theme choices. */
function ThemePreview({ dark }: { dark: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex flex-1 gap-1 p-1.5",
        dark ? "bg-[#0f1216]" : "bg-[#f5f6f8]",
      )}
    >
      <span
        className={cn(
          "w-[18px] rounded-[3px]",
          dark ? "bg-[#171b21]" : "bg-white",
        )}
      />
      <span className="flex flex-1 flex-col gap-1">
        <span
          className={cn(
            "h-2 w-3/5 rounded-[2px]",
            dark ? "bg-[#3a424d]" : "bg-[#c9cfd8]",
          )}
        />
        <span
          className={cn(
            "h-[22px] rounded-[3px]",
            dark ? "bg-[#171b21]" : "bg-white",
          )}
        />
      </span>
    </span>
  );
}

/** Settings → General: language, time format, time zone and theme, for this device. */
export function GeneralSettings() {
  const t = useTranslations("Settings.general");
  const locale = useLocale();
  const intlLocale = useIntlLocale();
  const router = useRouter();
  const { theme = "system", setTheme } = useTheme();
  const prefs = usePreferences();
  // This page renders in the browser, so it can read the device's zone and usual clock.
  const deviceZone = systemTimeZone();
  const zone = prefs.timeZone ?? deviceZone;
  const regionClock =
    new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions()
      .hourCycle === "h23"
      ? "24"
      : "12";
  const timeFormat = prefs.timeFormat ?? regionClock;
  const example = new Intl.DateTimeFormat(intlLocale, {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2026, 10, 12, 19, 0)));

  function chooseLanguage(next: string) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    router.refresh();
  }

  return (
    <>
      <h2 className="text-[22px] font-bold">{t("title")}</h2>
      <SettingsCard title={t("region")}>
        <div className="flex max-w-[440px] flex-col gap-1.5">
          <SelectField
            label={t("language")}
            options={routing.locales.map((id) => ({
              id,
              label: nativeName(id),
            }))}
            value={locale}
            onChange={chooseLanguage}
          />
          <span className="text-muted-foreground text-[13px]">
            {t("languageHelp")}
          </span>
        </div>
        <RadioGroup
          value={timeFormat}
          onChange={(value) =>
            savePreferences({ timeFormat: value === "24" ? "24" : "12" })
          }
          className="flex flex-col"
        >
          <Label className="mb-1 text-sm font-semibold">
            {t("timeFormat")}
          </Label>
          {(["12", "24"] as const).map((value) => (
            <Radio
              key={value}
              value={value}
              className="group flex cursor-default items-start gap-3 py-2 text-[15px] font-semibold outline-none"
            >
              <RadioDot />
              {t(value === "12" ? "hours12" : "hours24")}
            </Radio>
          ))}
          <span className="text-muted-foreground text-[13px]">
            {t("timeFormatHelp")}
          </span>
        </RadioGroup>
        <div className="flex max-w-[440px] flex-col gap-1.5">
          <TimeZoneField
            label={t("timeZone")}
            value={zone}
            onChange={(timeZone) =>
              // Choosing the device's own zone goes back to following the device.
              savePreferences({
                timeZone: timeZone === deviceZone ? undefined : timeZone,
              })
            }
          />
          <span className="text-muted-foreground text-[13px]">
            {prefs.timeZone
              ? t("timeZoneChosen", { example })
              : t("timeZoneHelp", { example })}
          </span>
          {prefs.timeZone ? (
            <Button
              variant="link"
              className="h-auto self-start p-0 text-[13px] font-semibold"
              onPress={() => savePreferences({ timeZone: undefined })}
            >
              {t("useDeviceZone")}
            </Button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard title={t("theme")}>
        <RadioGroup
          aria-label={t("theme")}
          value={theme}
          onChange={setTheme}
          className="flex flex-wrap gap-3"
        >
          {(["system", "light", "dark"] as const).map((option) => (
            <Radio
              key={option}
              value={option}
              className="group bg-card data-focus-visible:ring-ring flex min-w-0 flex-[1_1_160px] cursor-default flex-col gap-2 rounded-xl p-2.5 ring-1 ring-[#e2e5ea] outline-none data-focus-visible:ring-2 data-selected:ring-2 data-selected:ring-[#1f5eff] dark:ring-white/10"
            >
              <span className="flex h-[72px] overflow-hidden rounded-lg ring-1 ring-[#e2e5ea] dark:ring-white/10">
                {option !== "dark" ? <ThemePreview dark={false} /> : null}
                {option !== "light" ? <ThemePreview dark /> : null}
              </span>
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <RadioDot />
                {t(`themes.${option}`)}
              </span>
              <span className="text-muted-foreground text-[13px]">
                {t(`themeHelp.${option}`)}
              </span>
            </Radio>
          ))}
        </RadioGroup>
        <span className="text-muted-foreground text-[13px]">
          {t("themeNote")}
        </span>
      </SettingsCard>
    </>
  );
}

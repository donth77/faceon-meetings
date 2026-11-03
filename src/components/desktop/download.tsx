"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { SettingsCard } from "@/components/settings/settings-nav";
import { LinkButton } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatSize } from "@/lib/desktop/downloads";
import { useDesktopDownload } from "@/lib/desktop/use-desktop-release";
import { publicEnv } from "@/lib/env";
import { useIntlLocale } from "@/lib/preferences";

/**
 * The landing page's Download for Windows (or Mac), under its main actions: on that
 * computer only, once its build is out. Other computers' builds are on /download.
 */
export function DownloadForThisComputer() {
  const t = useTranslations("DesktopApp");
  const found = useDesktopDownload();
  if (!found) return null;
  return (
    <LinkButton
      href={found.download.url}
      variant="ghost"
      className="h-11 gap-2 rounded-xl px-4 text-[15px] font-semibold"
    >
      <Download aria-hidden="true" />
      {t(`download.${found.platform}`)}
    </LinkButton>
  );
}

/**
 * Settings → General on a Mac or Windows, once its build is out: what the app adds, its
 * download and one short line. Phones and other computers get the web app's install.
 */
export function DesktopDownloadCard() {
  const t = useTranslations("DesktopApp");
  const locale = useIntlLocale();
  const found = useDesktopDownload();
  if (!found) return null;
  const { version } = found.release;
  const { size } = found.download;
  return (
    <SettingsCard title={t("cardTitle")}>
      <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
        {t("cardBody", { appName: publicEnv.NEXT_PUBLIC_APP_NAME })}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <LinkButton
          href={found.download.url}
          className="h-10 gap-2 rounded-lg px-4 text-sm font-semibold"
        >
          <Download aria-hidden="true" />
          {t(`download.${found.platform}`)}
        </LinkButton>
        {version ? (
          <span className="text-muted-foreground text-[13px]">
            {size
              ? t("versionSize", { version, size: formatSize(size, locale) })
              : t("version", { version })}
          </span>
        ) : null}
      </div>
    </SettingsCard>
  );
}

/** The account menu's Download for Windows (or Mac). */
export function DesktopDownloadMenuItem() {
  const t = useTranslations("DesktopApp");
  const found = useDesktopDownload();
  if (!found) return null;
  return (
    <DropdownMenuItem href={found.download.url}>
      <Download aria-hidden="true" />
      {t(`download.${found.platform}`)}
    </DropdownMenuItem>
  );
}

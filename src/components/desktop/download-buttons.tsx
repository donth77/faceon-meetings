"use client";

import { ChevronRight, Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { LinkButton } from "@/components/ui/button";
import {
  DESKTOP_PLATFORMS,
  formatSize,
  type DesktopRelease,
} from "@/lib/desktop/downloads";
import { useDeviceKind } from "@/lib/desktop/use-desktop-release";
import { publicEnv } from "@/lib/env";
import { useIntlLocale } from "@/lib/preferences";

/**
 * /download: every build of the latest release, this computer's first and in front,
 * each with its kind, size and (unsigned) how to open it the first time; then the
 * version and all releases.
 */
export function DownloadButtons({ release }: { release: DesktopRelease }) {
  const t = useTranslations("Download");
  const tApp = useTranslations("DesktopApp");
  const locale = useIntlLocale();
  const device = useDeviceKind();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const builds = DESKTOP_PLATFORMS.flatMap((platform) => {
    const download = release[platform];
    return download ? [{ platform, download }] : [];
  }).sort(
    (a, b) => Number(b.platform === device) - Number(a.platform === device),
  );
  const { version } = release;
  const date = release.publishedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(release.publishedAt),
      )
    : null;
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {builds.map(({ platform, download }) => {
          const kind = t(`build.${platform}.kind`);
          const arch = t(`build.${platform}.arch`);
          return (
            <li
              key={platform}
              className="bg-card ring-border flex flex-col gap-2.5 rounded-2xl p-5 ring-1"
            >
              <h2 className="text-lg font-bold">
                {t(`build.${platform}.title`)}
              </h2>
              <p className="text-muted-foreground text-sm leading-normal">
                {download.size
                  ? t("detailSize", {
                      kind,
                      arch,
                      size: formatSize(download.size, locale),
                    })
                  : t("detail", { kind, arch })}
                <br />
                {t(`requires.${platform}`)}
              </p>
              <LinkButton
                href={download.url}
                variant={platform === device ? "default" : "outline"}
                className="mt-1 h-11 gap-2 rounded-xl px-4 text-[15px] font-semibold"
              >
                <Download aria-hidden="true" />
                {tApp(`download.${platform}`)}
              </LinkButton>
              {download.signed ? null : (
                <p className="text-muted-foreground text-[13px] leading-normal">
                  {t(`unsigned.${platform}`, { appName })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {version ? (
          <span>
            {date
              ? t("versionOn", { version, date })
              : t("version", { version })}
          </span>
        ) : null}
        <a
          href={release.releases}
          className="text-primary focus-visible:focus-ring inline-flex items-center rounded font-semibold underline-offset-4 outline-hidden hover:underline"
        >
          {t("allReleases")}
          <ChevronRight className="size-4" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}

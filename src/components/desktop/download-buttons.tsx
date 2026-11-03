"use client";

import { cn } from "cn";
import { ChevronRight, Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { LinkButton } from "@/components/ui/button";
import {
  downloadView,
  formatSize,
  type DesktopRelease,
  type DeviceKind,
  type DownloadView,
} from "@/lib/desktop/downloads";
import {
  useDesktopRelease,
  useDeviceKind,
} from "@/lib/desktop/use-desktop-release";
import { publicEnv } from "@/lib/env";
import { useIntlLocale } from "@/lib/preferences";

/** Both builds, as they read: the place they take, kept unseen until the real ones are known. */
const HOLDER: DesktopRelease = {
  version: "0.0.0",
  publishedAt: "2026-01-01T00:00:00Z",
  releases: "#",
  windows: { url: "#", size: 200 * 1_048_576, signed: false },
  mac: { url: "#", size: 200 * 1_048_576, signed: false },
};

/**
 * /download's heading and builds (lib/desktop/downloads.ts, downloadView): on Windows or a
 * Mac just its own, anywhere else every build, and the heading names what's offered. Like
 * the other download links, the release comes from /api/desktop/release once the page
 * runs. Until this browser and the release are known, the heading and the builds keep
 * their place unseen, so the heading never changes in front of anyone.
 */
export function DownloadPanel() {
  const t = useTranslations("Download");
  const device = useDeviceKind();
  const release = useDesktopRelease();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const known = device !== null && release !== undefined;
  const view = known && release ? downloadView(release, device) : null;
  const [first, second] = view?.builds ?? [];
  const only = first && !second ? first.platform : null;
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1
          className={cn(
            "font-display text-4xl font-bold text-balance",
            !known && "invisible",
          )}
        >
          {only ? t(`titleFor.${only}`, { appName }) : t("title", { appName })}
        </h1>
        <p className="text-muted-foreground max-w-[60ch] text-lg leading-normal">
          {t("intro", { appName })}
        </p>
      </div>
      {!known ? (
        <div className="invisible" inert>
          <Builds
            release={HOLDER}
            view={downloadView(HOLDER, "otherComputer")}
            device={null}
          />
        </div>
      ) : release && view ? (
        <Builds release={release} view={view} device={device} />
      ) : (
        <p className="bg-card ring-border max-w-[60ch] rounded-2xl p-5 text-[15px] leading-normal ring-1">
          {t("notYet", { appName })}
        </p>
      )}
    </>
  );
}

/**
 * The builds offered, each with its kind, size and (unsigned) how to open it the first
 * time, beside this computer's own when it isn't out yet (in the row's spare place, so
 * nothing below moves); then the version and all releases.
 */
function Builds({
  release,
  view,
  device,
}: {
  release: DesktopRelease;
  view: DownloadView;
  device: DeviceKind | null;
}) {
  const t = useTranslations("Download");
  const tApp = useTranslations("DesktopApp");
  const locale = useIntlLocale();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const { version } = release;
  const date = release.publishedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(release.publishedAt),
      )
    : null;
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {view.builds.map(({ platform, download }) => {
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
        {view.coming ? (
          <li className="border-muted-foreground/40 flex flex-col gap-2.5 rounded-2xl border border-dashed p-5">
            <h2 className="text-lg font-bold">
              {t(`build.${view.coming}.title`)}
            </h2>
            <p className="text-muted-foreground text-sm leading-normal">
              {t(`coming.${view.coming}`, { appName })}
            </p>
          </li>
        ) : null}
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

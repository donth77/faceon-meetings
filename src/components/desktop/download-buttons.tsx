"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { useIntlLocale } from "@/lib/preferences";

type Platform = "mac" | "windows";

const detect = (): Platform | null =>
  /Macintosh/.test(navigator.userAgent)
    ? "mac"
    : /Windows/.test(navigator.userAgent)
      ? "windows"
      : null;
const subscribeNever = () => () => {};

/** The downloads, this computer's first (decided in the browser; Mac first before that). */
export function DownloadButtons({
  version,
  publishedAt,
  mac,
  windows,
  page,
}: {
  version: string;
  publishedAt: string | null;
  mac: string | null;
  windows: string | null;
  page: string;
}) {
  const t = useTranslations("Download");
  const locale = useIntlLocale();
  const platform = useSyncExternalStore(subscribeNever, detect, () => null);
  const files: Array<{ platform: Platform; url: string }> = [
    ...(mac ? [{ platform: "mac" as const, url: mac }] : []),
    ...(windows ? [{ platform: "windows" as const, url: windows }] : []),
  ];
  if (platform === "windows") files.reverse();
  const date = publishedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(publishedAt),
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {files.map((file, index) => (
          <li
            key={file.platform}
            className="bg-card ring-border flex flex-col gap-3 rounded-2xl p-5 ring-1"
          >
            <span className="text-lg font-bold">
              {t(`for.${file.platform}`)}
            </span>
            <span className="text-muted-foreground text-sm leading-normal">
              {t(`requires.${file.platform}`)}
            </span>
            <a
              href={file.url}
              className={
                (index === 0
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "ring-border hover:bg-muted ring-1") +
                " focus-visible:focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold outline-hidden"
              }
            >
              <Download className="size-[18px]" aria-hidden="true" />
              {t("download", { platform: t(`platform.${file.platform}`) })}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">
        {date ? t("versionOn", { version, date }) : t("version", { version })}{" "}
        <a
          href={page}
          className="text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline"
        >
          {t("allFiles")}
        </a>
      </p>
    </div>
  );
}

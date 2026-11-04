"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { LinkButton } from "@/components/ui/button";
import { useDesktopDownload } from "@/lib/desktop/use-desktop-release";

/**
 * The landing page's Download for Windows (or Mac), under its main actions: on that
 * computer only, once its build is out. Other computers' builds are on /download. A
 * module of its own, so the landing page doesn't carry the cards and menus in download.tsx.
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

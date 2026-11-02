"use client";

import { Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { SettingsCard } from "@/components/settings/settings-nav";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { publicEnv } from "@/lib/env";

/** Settings → General on a computer, once the desktop app is out: what it adds, and where. */
export function GetDesktopAppCard() {
  const t = useTranslations("DesktopApp");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  return (
    <SettingsCard title={t("cardTitle")}>
      <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
        {t("cardBody", { appName })}
      </p>
      <Link
        href="/download"
        className="bg-primary text-primary-foreground focus-visible:focus-ring inline-flex h-10 items-center gap-2 self-start rounded-lg px-4 text-sm font-semibold outline-hidden hover:opacity-90"
      >
        <Monitor className="size-4" aria-hidden="true" />
        {t("get")}
      </Link>
    </SettingsCard>
  );
}

/** The account menu's Get the desktop app, on computers. */
export function GetDesktopAppMenuItem() {
  const t = useTranslations("DesktopApp");
  return (
    <DropdownMenuItem href="/download">
      <Monitor aria-hidden="true" />
      {t("get")}
    </DropdownMenuItem>
  );
}

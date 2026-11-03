"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  DesktopAppHomeCard,
  DesktopDownloadCard,
  DesktopDownloadMenuItem,
} from "@/components/desktop/download";
import { OneTimeCard } from "@/components/home/one-time-card";
import { SettingsCard } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { noteDesktopAppAction } from "@/lib/desktop/actions";
import {
  homeInstallCard,
  installOffer,
  type InstallOffer,
} from "@/lib/desktop/downloads";
import { useDesktop } from "@/lib/desktop/use-desktop";
import {
  useDesktopRelease,
  useDeviceKind,
} from "@/lib/desktop/use-desktop-release";
import { publicEnv } from "@/lib/env";
import { useInstall, useInstallCard } from "@/lib/pwa/install";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

/** The iPhone's Share icon, inline in the instructions. */
const shareIcon = () => (
  <Share
    className="mx-0.5 inline size-4 align-[-2px]"
    aria-hidden="true"
    strokeWidth={2.25}
  />
);

/** Opens the browser's install prompt, and says so when it's done. */
function useInstallAction() {
  const t = useTranslations("Pwa.install");
  const { way, install } = useInstall();
  async function installApp() {
    const installed = await install();
    if (installed) toast.success(t("done", { appName }));
    return installed;
  }
  return { way, installApp };
}

/** Settings → General: how to install FaceOn in this browser, or that it is. */
function InstallAppCardInBrowser() {
  const t = useTranslations("Pwa.install");
  const { way, installApp } = useInstallAction();

  return (
    <SettingsCard title={t("title")}>
      <p className="text-muted-foreground max-w-[64ch] text-sm leading-normal">
        {way === "installed"
          ? t("installed", { appName })
          : t("intro", { appName })}
      </p>
      {way === "prompt" ? (
        <Button className="self-start" onPress={() => void installApp()}>
          <Download aria-hidden="true" />
          {t("button")}
        </Button>
      ) : way === "ios" ? (
        <p className="max-w-[64ch] text-sm leading-normal">
          {t.rich("ios", { share: shareIcon })}
        </p>
      ) : way === "macSafari" ? (
        <p className="max-w-[64ch] text-sm leading-normal">{t("macSafari")}</p>
      ) : way === "none" ? (
        <p className="max-w-[64ch] text-sm leading-normal">{t("none")}</p>
      ) : null}
    </SettingsCard>
  );
}

/** The account menu's Install app, where the browser offers its prompt. */
function InstallMenuItemInBrowser() {
  const t = useTranslations("Pwa.install");
  const { way, installApp } = useInstallAction();
  if (way !== "prompt") return null;
  return (
    <DropdownMenuItem onAction={() => void installApp()}>
      <Download aria-hidden="true" />
      {t("button")}
    </DropdownMenuItem>
  );
}

/**
 * Home, on phones: a one-time card offering the app, where this browser can install it.
 * Not now (or Got it) puts it away for good on this device; Settings still has it.
 */
function InstallCardInBrowser() {
  const t = useTranslations("Pwa.install.card");
  const { way, installApp } = useInstallAction();
  const { dismissed, dismiss } = useInstallCard();
  if (dismissed || (way !== "prompt" && way !== "ios")) return null;

  return (
    <OneTimeCard
      label={t("label", { appName })}
      icon={Smartphone}
      title={t("title", { appName })}
      body={
        way === "prompt" ? t("prompt") : t.rich("ios", { share: shareIcon })
      }
      onDismiss={dismiss}
      className="md:hidden"
      actions={(close) =>
        way === "prompt" ? (
          <>
            <Button
              className="h-10 rounded-[10px]"
              onPress={() =>
                void installApp().then((installed) => {
                  if (installed) close();
                })
              }
            >
              <Download aria-hidden="true" />
              {t("label", { appName })}
            </Button>
            <Button
              variant="ghost"
              className="h-10 rounded-[10px]"
              onPress={close}
            >
              {t("notNow")}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            className="h-10 rounded-[10px]"
            onPress={close}
          >
            {t("gotIt")}
          </Button>
        )
      }
    />
  );
}

/**
 * What to offer (lib/desktop/downloads.ts, installOffer), decided once the page runs
 * here, since the cached page is everyone's.
 */
function useInstallOffer(): InstallOffer {
  const inApp = useDesktop() !== null;
  const device = useDeviceKind();
  const desktopPlatform = device === "windows" || device === "mac";
  const release = useDesktopRelease(desktopPlatform && !inApp);
  return installOffer({ inApp, device, release });
}

export function InstallAppCard() {
  const offer = useInstallOffer();
  if (offer === "none") return null;
  return offer === "download" ? (
    <DesktopDownloadCard />
  ) : (
    <InstallAppCardInBrowser />
  );
}

export function InstallMenuItem() {
  const offer = useInstallOffer();
  if (offer === "download") return <DesktopDownloadMenuItem />;
  return offer === "web" ? <InstallMenuItemInBrowser /> : null;
}

let notedDesktopApp = false;

/** Notes once per page load that this account uses the desktop app. */
function noteDesktopApp() {
  if (notedDesktopApp) return;
  notedDesktopApp = true;
  void noteDesktopAppAction().catch(() => {
    notedDesktopApp = false;
  });
}

/**
 * Home's one-time card (lib/desktop/downloads.ts, homeInstallCard): the desktop app's on
 * a Mac or Windows, unless this account uses the app already, or the web app's install on
 * phones. Inside the desktop app, it notes that this account uses it instead.
 */
export function InstallCard({ desktopAppUsed }: { desktopAppUsed: boolean }) {
  const inApp = useDesktop() !== null;
  const offer = useInstallOffer();
  useEffect(() => {
    if (inApp && !desktopAppUsed) noteDesktopApp();
  }, [inApp, desktopAppUsed]);
  const card = homeInstallCard(offer, desktopAppUsed);
  if (card === "desktop") return <DesktopAppHomeCard />;
  return card === "web" ? <InstallCardInBrowser /> : null;
}

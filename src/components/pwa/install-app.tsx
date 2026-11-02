"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import {
  GetDesktopAppCard,
  GetDesktopAppMenuItem,
} from "@/components/desktop/get-desktop-app";
import { SettingsCard } from "@/components/settings/settings-nav";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useDesktop, useIsComputer } from "@/lib/desktop/use-desktop";
import { useDesktopRelease } from "@/lib/desktop/use-desktop-release";
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
  const card = useRef<HTMLElement>(null);
  if (dismissed || (way !== "prompt" && way !== "ios")) return null;

  // The card goes away with the button pressed in it: focus moves to the page first.
  const close = () => {
    if (card.current?.contains(document.activeElement)) {
      document.getElementById("main")?.focus();
    }
    dismiss();
  };

  return (
    <section
      ref={card}
      aria-label={t("label", { appName })}
      className="bg-card ring-border flex flex-col gap-3 rounded-2xl p-4.5 ring-1 md:hidden"
    >
      <div className="flex items-start gap-3">
        <span className="bg-chip text-chip-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Smartphone className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold">{t("title", { appName })}</h2>
          <p className="text-muted-foreground text-sm leading-normal">
            {way === "prompt"
              ? t("prompt")
              : t.rich("ios", { share: shareIcon })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {way === "prompt" ? (
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
        )}
      </div>
    </section>
  );
}

// Install offers stay out of the desktop app, which is installed already. On computers,
// once the desktop app is out, they offer it instead; phones keep these.
function useInstallOffer(): "none" | "desktop" | "web" {
  const desktop = useDesktop();
  const computer = useIsComputer();
  const release = useDesktopRelease();
  if (desktop) return "none";
  if (!computer) return "web";
  if (release === undefined) return "none";
  return release ? "desktop" : "web";
}

export function InstallAppCard() {
  const offer = useInstallOffer();
  if (offer === "none") return null;
  return offer === "desktop" ? (
    <GetDesktopAppCard />
  ) : (
    <InstallAppCardInBrowser />
  );
}

export function InstallMenuItem() {
  const offer = useInstallOffer();
  if (offer === "none") return null;
  return offer === "desktop" ? (
    <GetDesktopAppMenuItem />
  ) : (
    <InstallMenuItemInBrowser />
  );
}

export const InstallCard = () =>
  useDesktop() ? null : <InstallCardInBrowser />;

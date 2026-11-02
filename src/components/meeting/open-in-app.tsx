"use client";

import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useDesktopRelease } from "@/lib/desktop/use-desktop-release";
import { publicEnv } from "@/lib/env";
import { savePreferences } from "@/lib/preferences";

import { MeetingPageFrame } from "./page-frame";

const LINK =
  "text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline";

/**
 * The join page where this browser knows the desktop app is on this computer
 * (lib/desktop/open-in-app.ts). Ask each time: open the meeting in the app, or join
 * here, with a way to always open the app. Always: it opens the app at once, with a way
 * back to joining here and to the setting.
 */
export function OpenInApp({
  link,
  mode,
  signedIn,
  onJoinHere,
}: {
  link: string;
  mode: "ask" | "launch";
  signedIn: boolean;
  onJoinHere: () => void;
}) {
  const t = useTranslations("OpenInApp");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const [always, setAlways] = useState(false);
  const launched = useRef(false);
  const openLink = useRef<HTMLAnchorElement>(null);

  // The screen changed: focus its main choice.
  useEffect(() => {
    if (mode === "ask") openLink.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode !== "launch" || launched.current) return;
    launched.current = true;
    window.location.href = link;
  }, [mode, link]);

  if (mode === "launch") {
    return (
      <MeetingPageFrame>
        <section className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center gap-4 px-5 py-12 text-center">
          <LoaderCircle
            className="text-primary size-8 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-bold" aria-live="polite">
            {t("opening", { appName })}
          </h1>
          <p className="text-muted-foreground text-[15px] leading-normal">
            {t("didntOpen")}
          </p>
          <Button variant="outline" onPress={onJoinHere} autoFocus>
            {t("joinHere")}
          </Button>
          {signedIn ? (
            <Link href="/settings" className={LINK}>
              {t("changeSetting")}
            </Link>
          ) : (
            <button
              type="button"
              className={LINK}
              onClick={() => {
                savePreferences({ desktopLinks: "ask" });
                onJoinHere();
              }}
            >
              {t("askEachTime")}
            </button>
          )}
        </section>
      </MeetingPageFrame>
    );
  }

  return (
    <MeetingPageFrame>
      <section className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center gap-5 px-5 py-12">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold text-balance">
            {t("askTitle", { appName })}
          </h1>
          <p className="text-muted-foreground text-[15px] leading-normal">
            {t("askBody", { appName })}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <a
            ref={openLink}
            href={link}
            className="bg-primary text-primary-foreground focus-visible:focus-ring inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-4 text-[17px] font-semibold outline-hidden hover:opacity-90"
          >
            <ArrowUpRight className="size-5" aria-hidden="true" />
            {t("openInApp", { appName })}
          </a>
          <Button
            variant="outline"
            className="h-[52px] rounded-xl text-[17px] font-semibold"
            onPress={onJoinHere}
          >
            {t("joinHere")}
          </Button>
        </div>
        <label className="flex items-center justify-center gap-2.5 text-[15px]">
          <input
            type="checkbox"
            checked={always}
            onChange={(event) => {
              setAlways(event.target.checked);
              savePreferences({
                desktopLinks: event.target.checked ? "always" : "ask",
              });
            }}
            className="accent-primary focus-visible:focus-ring size-[18px] rounded"
          />
          {t("always")}
        </label>
      </section>
    </MeetingPageFrame>
  );
}

/**
 * On a computer whose browser doesn't know the app is installed: a quiet offer under
 * Join now, with the download, once there's a release. It never opens the app itself.
 */
export function SuggestDesktopApp({ link }: { link: string }) {
  const t = useTranslations("OpenInApp");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const release = useDesktopRelease();
  if (!release) return null;
  return (
    <p className="text-muted-foreground text-center text-[13px] leading-normal">
      {t.rich("suggest", {
        appName,
        open: (chunks) => (
          <a href={link} className={LINK}>
            {chunks}
          </a>
        ),
        get: (chunks) => (
          <Link href="/download" className={LINK}>
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

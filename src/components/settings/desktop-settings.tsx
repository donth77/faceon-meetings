"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/form-fields";
import {
  acceleratorFromKey,
  formatAccelerator,
  type ShortcutPlatform,
} from "@/lib/desktop/accelerator";
import type {
  DesktopPreferences,
  DesktopUpdateState,
} from "@/lib/desktop/bridge";
import { useDesktop } from "@/lib/desktop/use-desktop";
import { publicEnv } from "@/lib/env";

import { SectionTitle, SettingsCard } from "./settings-nav";

const LINK =
  "text-primary focus-visible:focus-ring rounded font-semibold underline-offset-4 outline-hidden hover:underline";

/**
 * Settings → Desktop app, inside the FaceOn app for Mac and Windows: how it starts and
 * stays, the mute shortcut that works from any app, the badge, and updates. The app keeps
 * these (desktop/src/main/store.ts); this page reads and changes them through its bridge.
 */
export function DesktopSettings() {
  const t = useTranslations("Settings.desktop");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const desktop = useDesktop();
  const [preferences, setPreferences] = useState<DesktopPreferences | null>(
    null,
  );
  const [update, setUpdate] = useState<DesktopUpdateState | null>(null);

  useEffect(() => {
    if (!desktop) return;
    void desktop.preferences.get().then(setPreferences);
    void desktop.updates.get().then(setUpdate);
    return desktop.updates.onChange(setUpdate);
  }, [desktop]);

  if (!desktop) {
    return (
      <>
        <SectionTitle title={t("title")} />
        <p className="text-muted-foreground max-w-[64ch] text-[15px] leading-normal">
          {t("notInApp", { appName })}
        </p>
      </>
    );
  }
  if (!preferences) return null;

  const platform = desktop.platform;
  const change = async (next: Partial<DesktopPreferences>) =>
    setPreferences(await desktop.preferences.set(next));
  const shortcut = preferences.muteShortcut;

  return (
    <>
      <SectionTitle title={t("title")} intro={t("intro", { appName })} />
      <SettingsCard title={t("startup")}>
        <SwitchRow
          label={t("launchAtLogin", { appName })}
          isSelected={preferences.launchAtLogin}
          onChange={(on) => void change({ launchAtLogin: on })}
        />
        {platform === "mac" ? null : (
          <SwitchRow
            label={t("keepInTray", { appName })}
            help={t("keepInTrayHelp")}
            isSelected={preferences.keepInTray}
            onChange={(on) => void change({ keepInTray: on })}
          />
        )}
        <SwitchRow
          label={t("openLinks")}
          help={t("openLinksHelp", { appName })}
          isSelected={preferences.openLinksInApp}
          onChange={(on) => void change({ openLinksInApp: on })}
        />
      </SettingsCard>
      <SettingsCard title={t("meetings")}>
        <SwitchRow
          label={t("muteShortcut")}
          help={t("muteShortcutHelp", {
            shortcut: formatAccelerator(shortcut.accelerator, platform),
          })}
          isSelected={shortcut.enabled}
          onChange={(enabled) =>
            void change({ muteShortcut: { ...shortcut, enabled } })
          }
        />
        {shortcut.enabled ? (
          <ShortcutRecorder
            value={shortcut.accelerator}
            platform={platform}
            onChange={(accelerator) =>
              void change({ muteShortcut: { ...shortcut, accelerator } })
            }
          />
        ) : null}
        <SwitchRow
          label={t(platform === "mac" ? "badgeDock" : "badgeTaskbar")}
          isSelected={preferences.badge}
          onChange={(on) => void change({ badge: on })}
        />
        <p className="text-muted-foreground text-[13px] leading-normal">
          {t.rich("reminders", {
            link: (chunks) => (
              <Link href="/settings/notifications" className={LINK}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </SettingsCard>
      <SettingsCard title={t("updates")}>
        <Updates
          version={desktop.version}
          state={update}
          onCheck={() => desktop.updates.check()}
          onInstall={() => desktop.updates.install()}
        />
        <SwitchRow
          label={t("testBuilds")}
          help={t("testBuildsHelp")}
          isSelected={preferences.channel === "beta"}
          onChange={(on) => void change({ channel: on ? "beta" : "latest" })}
        />
      </SettingsCard>
    </>
  );
}

/** The mute shortcut: Change…, then the keys to use. Escape keeps the old one. */
function ShortcutRecorder({
  value,
  platform,
  onChange,
}: {
  value: string;
  platform: ShortcutPlatform;
  onChange: (accelerator: string) => void;
}) {
  const t = useTranslations("Settings.desktop");
  const [recording, setRecording] = useState(false);
  const [problem, setProblem] = useState(false);

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    if (event.key === "Tab") return;
    event.preventDefault();
    if (event.key === "Escape") {
      setRecording(false);
      setProblem(false);
      return;
    }
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    const accelerator = acceleratorFromKey(event, platform);
    if (!accelerator) {
      setProblem(true);
      return;
    }
    setRecording(false);
    setProblem(false);
    onChange(accelerator);
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[15px] font-semibold">{t("shortcut")}</span>
        <div className="flex items-center gap-2">
          <kbd className="border-border bg-muted rounded-md border px-2 py-1 font-mono text-sm">
            {formatAccelerator(value, platform)}
          </kbd>
          <button
            type="button"
            aria-describedby={problem ? "shortcut-problem" : undefined}
            onClick={() => {
              setRecording(true);
              setProblem(false);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setRecording(false)}
            className="border-border hover:bg-muted focus-visible:focus-ring rounded-lg border px-3 py-1.5 text-sm font-semibold outline-hidden"
          >
            {recording ? t("pressShortcut") : t("change")}
          </button>
        </div>
      </div>
      {problem ? (
        <p
          id="shortcut-problem"
          role="alert"
          className="text-destructive-text text-sm"
        >
          {t("shortcutProblem")}
        </p>
      ) : null}
    </div>
  );
}

/** The version, and where updates stand: checking, downloading, ready to restart. */
function Updates({
  version,
  state,
  onCheck,
  onInstall,
}: {
  version: string;
  state: DesktopUpdateState | null;
  onCheck: () => void;
  onInstall: () => void;
}) {
  const t = useTranslations("Settings.desktop");
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;
  const status = state?.status ?? "disabled";

  let note: string | null = null;
  let action: React.ReactNode = null;
  switch (state?.status) {
    case "checking":
      note = t("checking");
      break;
    case "upToDate":
      note = t("upToDate", { appName });
      break;
    case "downloading":
      note = t("downloading", {
        version: state.version,
        percent: state.percent,
      });
      break;
    case "ready":
      note = t("ready", { version: state.version });
      action = <Button onPress={onInstall}>{t("restartNow")}</Button>;
      break;
    case "manual":
      note = t("manual", { appName, version: state.version });
      action = (
        <a href={state.url} target="_blank" rel="noreferrer" className={LINK}>
          {t("download")}
        </a>
      );
      break;
    case "failed":
      note = t("failed");
      break;
    case "disabled":
    case undefined:
      note = t("updatesOff");
      break;
    case "idle":
      break;
  }
  const canCheck =
    status === "idle" || status === "upToDate" || status === "failed";

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {t("version", { appName, version })}
          </span>
          {note ? (
            <span
              className="text-muted-foreground text-[13px]"
              aria-live="polite"
            >
              {note}
            </span>
          ) : null}
        </div>
        {action ??
          (canCheck ? (
            <Button variant="outline" onPress={onCheck}>
              {t("checkForUpdates")}
            </Button>
          ) : null)}
      </div>
    </div>
  );
}

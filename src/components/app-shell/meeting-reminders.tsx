"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";

import { subscribeMeetingsChanged } from "@/lib/meetings/changes";
import {
  occurrencesAction,
  type OccurrenceRow,
} from "@/lib/meetings/schedule-actions";
import {
  loadPreferences,
  subscribePreferences,
  useIntlLocale,
  withDefaults,
} from "@/lib/preferences";
import { meetingPath } from "@/lib/routes";
import { viewerTimeZone } from "@/lib/time";

/** How far ahead to look, and how often to look again. */
const LOOK_AHEAD_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;
/** Reminders already shown, so a reload doesn't repeat them. */
const SHOWN = "faceon.reminded";

/**
 * A system notification that opens the meeting when it's selected. Through the service
 * worker where there is one: Android's browsers and apps on an iPhone's Home Screen show
 * notifications only that way (their Notification constructor throws). Otherwise the
 * page shows its own, and where it can't, the reminder still shows in the page.
 */
async function notify(
  title: string,
  options: { body: string; tag: string; url: string },
  onOpen: () => void,
): Promise<void> {
  const worker = await navigator.serviceWorker
    ?.getRegistration()
    .catch(() => undefined);
  if (worker) {
    await worker
      .showNotification(title, {
        body: options.body,
        tag: options.tag,
        data: { url: options.url },
      })
      .catch(() => {});
    return;
  }
  try {
    const notice = new Notification(title, {
      body: options.body,
      tag: options.tag,
    });
    notice.onclick = () => {
      onOpen();
      notice.close();
    };
  } catch {
    // This browser shows notifications only through a service worker.
  }
}

function alreadyShown(key: string): boolean {
  try {
    return (
      JSON.parse(localStorage.getItem(SHOWN) ?? "[]") as string[]
    ).includes(key);
  } catch {
    return false;
  }
}

function markShown(key: string): void {
  try {
    const list = JSON.parse(localStorage.getItem(SHOWN) ?? "[]") as string[];
    localStorage.setItem(SHOWN, JSON.stringify([...list, key].slice(-50)));
  } catch {
    // Storage is blocked; at worst a reload reminds again.
  }
}

/**
 * Meeting reminders while FaceOn is open in a tab (Settings → Notifications): a system
 * notification when the browser allows them, and a pop-up in the page, a few minutes
 * before each meeting you host or are invited to. Calendar files carry the same reminder
 * for when FaceOn is closed.
 */
export function MeetingReminders() {
  const t = useTranslations("Reminders");
  const locale = useIntlLocale();
  const router = useRouter();

  const remind = useEffectEvent((row: OccurrenceRow) => {
    const key = `${row.code}@${row.start}`;
    if (alreadyShown(key)) return;
    markShown(key);
    const title = row.title ?? t("untitled", { name: row.hostName });
    const at = new Intl.DateTimeFormat(locale, {
      timeStyle: "short",
      timeZone: viewerTimeZone(),
    }).format(new Date(row.start));
    const link = meetingPath(row.code, row.passcode);
    // The real time left: a reminder can show late, when FaceOn was opened late.
    const left = Math.max(
      1,
      Math.round((new Date(row.start).getTime() - Date.now()) / 60_000),
    );
    const heading = t("startsSoon", { title, minutes: left });
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      void notify(
        heading,
        { body: t("body", { time: at }), tag: key, url: link },
        () => {
          window.focus();
          router.push(link);
        },
      );
    }
    toast(heading, {
      description: t("body", { time: at }),
      duration: 60_000,
      action: { label: t("join"), onClick: () => router.push(link) },
    });
  });

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;

    async function plan() {
      timers.forEach(clearTimeout);
      timers.clear();
      const minutes = withDefaults(loadPreferences()).reminderMinutes;
      if (minutes === 0) return;
      const now = Date.now();
      const rows = await occurrencesAction(
        new Date(now).toISOString(),
        new Date(now + LOOK_AHEAD_MS).toISOString(),
      ).catch(() => []);
      if (cancelled) return;
      for (const row of rows) {
        const start = new Date(row.start).getTime();
        if (start <= Date.now()) continue;
        // A reminder whose time has passed (FaceOn opened late) shows at once.
        const wait = Math.max(0, start - minutes * 60_000 - Date.now());
        if (wait > REFRESH_MS + 60_000) continue; // planned on a later look
        timers.add(setTimeout(() => remind(row), wait));
      }
    }

    void plan();
    const every = setInterval(() => void plan(), REFRESH_MS);
    // A meeting scheduled, moved or deleted (here or in another tab) is looked at now,
    // and so is the calendar when the tab comes back, rather than at the next look.
    const stopChanges = subscribeMeetingsChanged(() => void plan());
    const onVisible = () => {
      if (document.visibilityState === "visible") void plan();
    };
    document.addEventListener("visibilitychange", onVisible);
    // A new reminder time in Settings (here or in another tab) plans again; other
    // settings don't need another look at the calendar.
    let minutes = withDefaults(loadPreferences()).reminderMinutes;
    const unsubscribe = subscribePreferences(() => {
      const now = withDefaults(loadPreferences()).reminderMinutes;
      if (now === minutes) return;
      minutes = now;
      void plan();
    });
    return () => {
      cancelled = true;
      clearInterval(every);
      stopChanges();
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}

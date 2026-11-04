"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";

import { isDesktopApp } from "@/lib/desktop/use-desktop";
import { subscribeMeetingsChanged } from "@/lib/meetings/changes";
import {
  reminderKey,
  remindersDue,
  staleReminders,
} from "@/lib/meetings/reminders";
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
/** The page's own notifications, by reminder, to close one whose meeting goes. */
const notices = new Map<string, Notification>();

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
    notice.onclose = () => notices.delete(options.tag);
    notices.set(options.tag, notice);
  } catch {
    // This browser shows notifications only through a service worker.
  }
}

/** Closes a reminder's system notification, the service worker's or the page's own. */
async function closeNotification(tag: string): Promise<void> {
  notices.get(tag)?.close();
  notices.delete(tag);
  const worker = await navigator.serviceWorker
    ?.getRegistration()
    .catch(() => undefined);
  const shown = await worker?.getNotifications({ tag }).catch(() => []);
  shown?.forEach((notification) => notification.close());
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
 * for when FaceOn is closed. In the desktop app the page shows only the pop-up: the app
 * shows the system notification itself.
 */
export function MeetingReminders() {
  const t = useTranslations("Reminders");
  const locale = useIntlLocale();
  const router = useRouter();
  /** Reminders on screen now: one goes when its meeting is deleted or moved. */
  const showing = useRef(new Set<string>());

  const remind = useEffectEvent((row: OccurrenceRow) => {
    const key = reminderKey(row);
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
    // The desktop app shows its own system notification for each meeting, with its
    // window open, hidden or closed (desktop/src/main/reminders.ts): one from the page
    // too would be the same reminder twice.
    if (
      !isDesktopApp() &&
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
    showing.current.add(key);
    const gone = () => showing.current.delete(key);
    toast(heading, {
      id: key,
      description: t("body", { time: at }),
      duration: 60_000,
      action: { label: t("join"), onClick: () => router.push(link) },
      onDismiss: gone,
      onAutoClose: gone,
    });
  });

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let cancelled = false;
    /** The occurrences the last look found, to tell a changed meeting from the rest. */
    let known = new Set<string>();
    /** Occurrences first seen right after a change made here: no late reminder for them. */
    const fresh = new Set<string>();

    /**
     * Sets this tab's reminders. After a change made here (`changed`), a meeting that's
     * new or moved gets no reminder whose time has already passed: whoever just
     * scheduled it knows it's about to start.
     */
    async function plan(changed = false) {
      timers.forEach(clearTimeout);
      timers.clear();
      const minutes = withDefaults(loadPreferences()).reminderMinutes;
      if (minutes === 0) return;
      const now = Date.now();
      const rows = await occurrencesAction(
        new Date(now).toISOString(),
        new Date(now + LOOK_AHEAD_MS).toISOString(),
      ).catch(() => null);
      if (cancelled || !rows) return;
      // A meeting deleted or moved since its reminder showed: the reminder goes too.
      for (const key of staleReminders(showing.current, rows)) {
        showing.current.delete(key);
        toast.dismiss(key);
        void closeNotification(key);
      }
      const keys = rows.map(reminderKey);
      if (changed) {
        for (const key of keys) if (!known.has(key)) fresh.add(key);
      }
      known = new Set(keys);
      for (const key of fresh) if (!known.has(key)) fresh.delete(key);
      for (const { row, wait } of remindersDue({
        rows,
        now: Date.now(),
        minutes,
        horizon: REFRESH_MS + 60_000,
        late: (row) => !fresh.has(reminderKey(row)),
      })) {
        timers.add(setTimeout(() => remind(row), wait));
      }
    }

    void plan();
    const every = setInterval(() => void plan(), REFRESH_MS);
    // A meeting scheduled, moved or deleted (here or in another tab) is looked at now,
    // and so is the calendar when the tab comes back, rather than at the next look.
    const stopChanges = subscribeMeetingsChanged(() => void plan(true));
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

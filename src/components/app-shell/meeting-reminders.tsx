"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";

import {
  occurrencesAction,
  type OccurrenceRow,
} from "@/lib/meetings/schedule-actions";
import {
  loadPreferences,
  useIntlLocale,
  withDefaults,
} from "@/lib/preferences";

/** How far ahead to look, and how often to look again. */
const LOOK_AHEAD_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;
/** Reminders already shown, so a reload doesn't repeat them. */
const SHOWN = "faceon.reminded";

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
    const at = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
      new Date(row.start),
    );
    const link = `/j/${row.code}${row.passcode ? `#pwd=${row.passcode}` : ""}`;
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
      const notice = new Notification(heading, {
        body: t("body", { time: at }),
        tag: key,
      });
      notice.onclick = () => {
        window.focus();
        router.push(link);
        notice.close();
      };
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
    const onChange = () => void plan();
    window.addEventListener("faceon:prefs", onChange);
    return () => {
      cancelled = true;
      clearInterval(every);
      window.removeEventListener("faceon:prefs", onChange);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}

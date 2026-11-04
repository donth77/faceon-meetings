"use client";

import { useEffect } from "react";

import { useDesktop } from "@/lib/desktop/use-desktop";
import {
  loadPreferences,
  subscribePreferences,
  withDefaults,
} from "@/lib/preferences";

/**
 * Settings → Notifications' reminder time, copied into the desktop app, whose main
 * process shows the system notifications for meetings, even with no window open (it
 * can't read this page's storage). With Notifications off it's 0: no reminders.
 */
export function DesktopSync() {
  const desktop = useDesktop();
  useEffect(() => {
    if (!desktop) return;
    const send = () =>
      desktop.setReminderMinutes(
        withDefaults(loadPreferences()).reminderMinutes,
      );
    send();
    return subscribePreferences(send);
  }, [desktop]);
  return null;
}

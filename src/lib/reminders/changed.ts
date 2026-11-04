import "server-only";

import { after } from "next/server";

import { loggable } from "@/lib/log";

/**
 * What changed: someone's reminder settings (or account), or a meeting (its time, title,
 * passcode, repeats or invitees). The meeting's ID code is given when the meeting may be
 * gone by the time the reminders are brought in line.
 */
export type ReminderChange =
  { userId: string } | { meetingId: string; meetingCode?: string };

/**
 * Brings the reminder emails scheduled with Resend in line with a change, after the
 * response is sent, so saving never waits on Resend. (Outside a request it starts right
 * away.) The daily sweep catches anything this misses.
 */
export function remindersChanged(change: ReminderChange): void {
  const task = async () => {
    try {
      // Loaded when needed: it reads meetings, whose writers call this.
      const { reconcileReminders } = await import("./schedule");
      await reconcileReminders(change);
    } catch (error) {
      console.error("Reminder emails could not be updated", loggable(error));
    }
  };
  try {
    after(task);
  } catch {
    void task();
  }
}

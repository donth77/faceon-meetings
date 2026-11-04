import { Notification, type Session } from "electron";
import { z } from "zod";

import { appUrl } from "./config";
import {
  dueReminders,
  nextMeeting,
  type UpcomingMeeting,
} from "./reminder-schedule";
import { strings } from "./strings";

const Upcoming = z.object({
  meetings: z
    .array(
      z.object({
        id: z.string().max(100),
        title: z.string().max(200),
        startsAt: z.string().max(40),
        path: z
          .string()
          .max(300)
          .regex(/^\/(?![/\\])[^\s\\]*$/),
      }),
    )
    .max(200),
});

const LIST_EVERY_MS = 10 * 60_000;

/**
 * The app's meeting reminders, as system notifications with its window open, hidden or
 * closed (the page in the window shows only its own pop-up): the next day's meetings from
 * the server (with the window's own session), checked every minute against Settings →
 * Notifications' time.
 */
export class Reminders {
  private meetings: UpcomingMeeting[] = [];
  private readonly shown = new Set<string>();
  private listedAt = 0;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly ses: Session,
    private readonly minutes: () => number,
    private readonly join: (path: string) => void,
    private readonly onNext: (meeting: UpcomingMeeting | null) => void,
  ) {}

  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  stop() {
    clearInterval(this.timer);
  }

  /** After signing in or out, or a change of reminder time. */
  refresh() {
    this.listedAt = 0;
    void this.tick();
  }

  private async tick() {
    const now = Date.now();
    if (now - this.listedAt > LIST_EVERY_MS) await this.list();
    for (const { key, meeting } of dueReminders(
      this.meetings,
      this.minutes(),
      now,
      this.shown,
    )) {
      this.shown.add(key);
      this.notify(meeting, now);
    }
    this.onNext(nextMeeting(this.meetings, now));
  }

  private async list() {
    try {
      const response = await this.ses.fetch(appUrl("/api/desktop/upcoming"), {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (response.status === 401) this.meetings = [];
      else if (response.ok) {
        const parsed = Upcoming.safeParse(await response.json());
        if (parsed.success) this.meetings = parsed.data.meetings;
      }
      this.listedAt = Date.now();
    } catch {
      // Offline: the next tick tries again.
    }
  }

  private notify(meeting: UpcomingMeeting, now: number) {
    if (!Notification.isSupported()) return;
    const minutes = Math.max(
      1,
      Math.round((Date.parse(meeting.startsAt) - now) / 60_000),
    );
    const notification = new Notification({
      title: meeting.title,
      body: strings.startsIn(minutes),
      actions:
        process.platform === "darwin"
          ? [{ type: "button", text: strings.join }]
          : [],
    });
    notification.on("click", () => this.join(meeting.path));
    notification.on("action", () => this.join(meeting.path));
    notification.show();
  }
}

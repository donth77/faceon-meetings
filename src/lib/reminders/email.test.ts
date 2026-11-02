import { describe, expect, it } from "vitest";

import messages from "../../../messages/en.json";
import {
  reminderEmail,
  timeLeft,
  type ReminderKey,
  type ReminderOccurrence,
  type ReminderText,
} from "./email";

// The English messages, with their {placeholders} filled in.
const t: ReminderText = (key: ReminderKey, values = {}) => {
  const source =
    key === "linkFallback"
      ? messages.Emails.linkFallback
      : messages.Emails.reminder[key];
  return source.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
};

const occurrence: ReminderOccurrence = {
  code: "1234567890",
  title: "Design review",
  hostName: "Maya Chen",
  role: "invited",
  start: new Date("2026-11-10T14:00:00Z"),
  end: new Date("2026-11-10T15:00:00Z"),
  passcode: "K7XQ2M",
};

const email = (overrides: Partial<ReminderOccurrence> = {}) =>
  reminderEmail({
    to: "ana@example.com",
    occurrence: { ...occurrence, ...overrides },
    timeZone: "America/New_York",
    locale: "en",
    now: new Date("2026-11-10T13:50:00Z"),
    siteUrl: "https://joinfaceon.app",
    appName: "FaceOn",
    stopUrl: "https://joinfaceon.app/unsubscribe?token=abc",
    oneClickUrl: "https://joinfaceon.app/api/email/unsubscribe?token=abc",
    t,
  });

describe("a reminder email", () => {
  it("reads like the invitation: topic, time, Join, meeting ID and passcode", () => {
    const { subject, text, to } = email();
    expect(to).toBe("ana@example.com");
    expect(subject).toBe("Reminder: Design review starts in 10 minutes");
    expect(text).toContain(
      "Maya Chen is inviting you to a scheduled FaceOn meeting.",
    );
    expect(text).toContain("Topic: Design review");
    expect(text).toMatch(/Time: .*Nov 10, 2026.*New York \(GMT−05:00\)/);
    expect(text).toContain(
      "Join FaceOn meeting: https://joinfaceon.app/j/1234567890#pwd=K7XQ2M",
    );
    expect(text).toContain("Meeting ID: 123 456 7890");
    expect(text).toContain("Passcode: K7XQ2M");
  });

  it("gives times in the person's own time zone", () => {
    const tokyo = reminderEmail({
      ...{
        to: "ana@example.com",
        occurrence,
        locale: "en",
        now: new Date("2026-11-10T13:50:00Z"),
        siteUrl: "https://joinfaceon.app",
        appName: "FaceOn",
        stopUrl: "s",
        oneClickUrl: "o",
        t,
      },
      timeZone: "Asia/Tokyo",
    });
    expect(tokyo.text).toMatch(/Nov 10, 2026.*11:00.*Tokyo \(GMT\+09:00\)/);
  });

  it("tells a host they're hosting, and leaves out a passcode the meeting hasn't got", () => {
    const { text } = email({ role: "host", passcode: null });
    expect(text).toContain("You’re hosting this FaceOn meeting.");
    expect(text).not.toContain("Passcode:");
    expect(text).toContain("https://joinfaceon.app/j/1234567890\n");
  });

  it("names an untitled meeting after its host", () => {
    expect(email({ title: null }).subject).toBe(
      "Reminder: Maya Chen’s meeting starts in 10 minutes",
    );
  });

  it("says how to stop them, in the text and to mail apps", () => {
    const { text, html, headers } = email();
    expect(text).toContain(
      "Stop reminder emails: https://joinfaceon.app/unsubscribe?token=abc",
    );
    expect(html).toContain(
      'href="https://joinfaceon.app/unsubscribe?token=abc"',
    );
    expect(headers).toEqual({
      "List-Unsubscribe":
        "<https://joinfaceon.app/api/email/unsubscribe?token=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("escapes a title in the HTML", () => {
    const { html } = email({ title: "<b>Plans</b> & dates" });
    expect(html).toContain("&lt;b&gt;Plans&lt;/b&gt; &amp; dates");
    expect(html).not.toContain("<b>Plans</b>");
  });
});

describe("the time left, as the email says it", () => {
  const start = new Date("2026-11-10T15:00:00Z");
  const before = (minutes: number) =>
    timeLeft(start, new Date(start.getTime() - minutes * 60_000), "en");

  it("counts minutes under an hour, hours from there", () => {
    expect(before(10)).toBe("in 10 minutes");
    expect(before(58)).toBe("in 58 minutes");
    expect(before(61)).toBe("in 1 hour");
    expect(before(24 * 60 - 4)).toBe("in 24 hours");
  });
});

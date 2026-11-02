import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatDay,
  formatDuration,
  formatSpan,
  formattingLocale,
  isSameDay,
  timeRangeParts,
} from "./time";

describe("formattingLocale", () => {
  it("uses the browser's own tag when it's in FaceOn's language", () => {
    expect(formattingLocale("en", "en-GB")).toBe("en-GB");
    expect(formattingLocale("en", "en-US")).toBe("en-US");
  });

  it("borrows only the region from a browser in another language", () => {
    expect(formattingLocale("en", "de-DE")).toBe("en-DE");
    expect(formattingLocale("en", "fr")).toBe("en-FR");
  });

  it("falls back to the language without a usable browser locale", () => {
    expect(formattingLocale("en", "")).toBe("en");
    expect(formattingLocale("en", "not a locale!")).toBe("en");
  });
});

describe("formatDay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const day = { weekday: "long", month: "long", day: "numeric" } as const;

  it("leaves out this year", () => {
    vi.useFakeTimers({ now: new Date("2026-11-01T15:00:00Z") });
    expect(formatDay(new Date("2026-11-01T15:00:00Z"), "en-US", day)).toBe(
      "Sunday, November 1",
    );
    expect(formatDay(new Date("2026-11-01T15:00:00Z"), "en-GB", day)).toBe(
      "Sunday 1 November",
    );
  });

  it("adds any other year", () => {
    vi.useFakeTimers({ now: new Date("2026-11-01T15:00:00Z") });
    expect(formatDay(new Date("2027-01-08T15:00:00Z"), "en-US", day)).toBe(
      "Friday, January 8, 2027",
    );
  });

  it("decides the year in the zone shown", () => {
    // 2027 has begun in Tokyo but not yet in New York.
    vi.useFakeTimers({ now: new Date("2026-12-31T20:00:00Z") });
    const instant = new Date("2026-12-31T20:00:00Z");
    expect(
      formatDay(instant, "en-US", { ...day, timeZone: "America/New_York" }),
    ).toBe("Thursday, December 31");
    expect(
      formatDay(instant, "en-US", { ...day, timeZone: "Asia/Tokyo" }),
    ).toBe("Friday, January 1");
  });
});

/** Intl's thin and narrow no-break spaces, as plain ones, to compare text. */
const plain = (text: string) => text.replace(/\s/g, " ");

describe("isSameDay", () => {
  it("decides the day in the zone shown", () => {
    // 10:32 PM on Nov 1 in New York is already Nov 2 in UTC.
    const late = new Date("2026-11-02T03:32:29Z");
    const morning = new Date("2026-11-02T15:49:31Z");
    expect(isSameDay(late, morning, "UTC")).toBe(true);
    expect(isSameDay(late, morning, "America/New_York")).toBe(false);
  });
});

describe("timeRangeParts", () => {
  const zone = "America/New_York";
  const parts = (...args: Parameters<typeof timeRangeParts>) => {
    const { times, endDay } = timeRangeParts(...args);
    return { times: plain(times), endDay: endDay && plain(endDay) };
  };

  it("shows a meeting within one day as a plain range", () => {
    expect(
      parts(
        new Date("2026-11-02T15:18:40Z"),
        new Date("2026-11-02T15:49:31Z"),
        zone,
        "en-US",
      ),
    ).toEqual({ times: "10:18 – 10:49 AM", endDay: null });
  });

  it("keeps the times short across midnight and names the day it ended", () => {
    expect(
      parts(
        new Date("2026-11-02T03:32:29Z"),
        new Date("2026-11-02T15:49:31Z"),
        zone,
        "en-US",
      ),
    ).toEqual({ times: "10:32 PM – 10:49 AM", endDay: "Mon, Nov 2" });
  });

  it("joins the times the way the locale joins a range", () => {
    expect(
      parts(
        new Date("2026-11-02T03:32:29Z"),
        new Date("2026-11-02T15:49:31Z"),
        zone,
        "de-DE",
      ).times,
    ).toBe("22:32–10:49 Uhr");
  });
});

describe("formatSpan", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  const span = (...args: Parameters<typeof formatSpan>) =>
    plain(formatSpan(...args));

  it("names the day once for a meeting within it", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T18:00:00Z") });
    expect(
      span(
        new Date("2026-11-02T15:18:40Z"),
        new Date("2026-11-02T15:49:31Z"),
        "America/New_York",
        "en-US",
      ),
    ).toBe("Mon, Nov 2 · 10:18 – 10:49 AM");
  });

  it("names both days across midnight", () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T18:00:00Z") });
    expect(
      span(
        new Date("2026-11-02T03:32:29Z"),
        new Date("2026-11-02T15:49:31Z"),
        "America/New_York",
        "en-US",
      ),
    ).toBe("Sun, Nov 1, 10:32 PM – Mon, Nov 2, 10:49 AM");
  });
});

describe("formatDuration", () => {
  const duration = (...args: Parameters<typeof formatDuration>) =>
    plain(formatDuration(...args));

  it("says minutes under an hour, and hours and minutes from an hour", () => {
    expect(duration(31, "en-US")).toBe("31 min");
    expect(duration(60, "en-US")).toBe("1 hr");
    expect(duration(75, "en-US")).toBe("1 hr, 15 min");
    expect(duration(324, "en-US")).toBe("5 hr, 24 min");
    expect(duration(0, "en-US")).toBe("0 min");
  });

  it("has a long style, for choosing a length", () => {
    expect(duration(90, "en-US", "long")).toBe("1 hour, 30 minutes");
    expect(duration(45, "en-US", "long")).toBe("45 minutes");
  });

  it("speaks the locale's language", () => {
    expect(duration(75, "de-DE")).toBe("1 Std., 15 Min.");
    expect(duration(75, "ja-JP")).toBe("1 時間 15 分");
  });

  it("says the same where the browser has no Intl.DurationFormat", () => {
    const original = Object.getOwnPropertyDescriptor(Intl, "DurationFormat");
    Object.defineProperty(Intl, "DurationFormat", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(duration(31, "en-US")).toBe("31 min");
      expect(duration(60, "en-US")).toBe("1 hr");
      expect(duration(75, "en-US")).toBe("1 hr, 15 min");
      expect(duration(90, "en-US", "long")).toBe("1 hour, 30 minutes");
    } finally {
      if (original) Object.defineProperty(Intl, "DurationFormat", original);
    }
  });
});

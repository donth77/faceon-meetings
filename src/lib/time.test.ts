import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDay, formattingLocale } from "./time";

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

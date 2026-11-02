import { describe, expect, it } from "vitest";

import { weekdayName, weekdaysInOrder } from "./weekdays";

describe("weekdaysInOrder", () => {
  it("starts on Sunday in the US and Monday in Germany", () => {
    expect(weekdaysInOrder("en-US")[0]).toBe("SU");
    expect(weekdaysInOrder("de-DE")).toEqual([
      "MO",
      "TU",
      "WE",
      "TH",
      "FR",
      "SA",
      "SU",
    ]);
  });
});

describe("weekdayName", () => {
  it("names a weekday in the reader's language", () => {
    expect(weekdayName("TU", "en-US", "long")).toBe("Tuesday");
    expect(weekdayName("SU", "en-US", "narrow")).toBe("S");
    expect(weekdayName("MO", "de-DE", "long")).toBe("Montag");
  });
});

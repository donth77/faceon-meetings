import { describe, expect, it } from "vitest";

import { oneOf } from "./narrow";

describe("oneOf", () => {
  const VIEWS = ["month", "week"] as const;

  it("returns a value that's in the list, typed", () => {
    const view: "month" | "week" | undefined = oneOf(VIEWS, "week");
    expect(view).toBe("week");
  });

  it("returns undefined for anything else", () => {
    expect(oneOf(VIEWS, "year")).toBeUndefined();
    expect(oneOf(VIEWS, 7)).toBeUndefined();
    expect(oneOf(VIEWS, null)).toBeUndefined();
  });
});

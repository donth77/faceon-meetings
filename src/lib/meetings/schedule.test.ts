import { describe, expect, it } from "vitest";

import { CohostList, cohostsAllowed, MAX_COHOSTS } from "./schedule";

describe("named co-hosts", () => {
  it("are email addresses, lowercased", () => {
    expect(CohostList.parse(["Ana@Example.com"])).toEqual(["ana@example.com"]);
    expect(CohostList.safeParse(["not an address"]).success).toBe(false);
  });

  it("can't name someone twice, or more than the most", () => {
    expect(
      CohostList.safeParse(["a@example.com", "A@example.com"]).success,
    ).toBe(false);
    const many = Array.from(
      { length: MAX_COHOSTS + 1 },
      (_, i) => `p${i}@example.com`,
    );
    expect(CohostList.safeParse(many).success).toBe(false);
    expect(CohostList.safeParse(many.slice(0, MAX_COHOSTS)).success).toBe(true);
  });

  it("never include the host, who hosts anyway", () => {
    expect(cohostsAllowed(["ben@example.com"], "Host@Example.com")).toBe(true);
    expect(cohostsAllowed(["host@example.com"], "Host@Example.com")).toBe(
      false,
    );
    expect(cohostsAllowed([], "host@example.com")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { isEmailAddress } from "./email-address";

describe("isEmailAddress", () => {
  it("accepts addresses, with spaces around them", () => {
    expect(isEmailAddress("maya@example.com")).toBe(true);
    expect(isEmailAddress("  maya.lee+work@mail.example.co.uk ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isEmailAddress("maya")).toBe(false);
    expect(isEmailAddress("maya@")).toBe(false);
    expect(isEmailAddress("maya@example")).toBe(false);
    expect(isEmailAddress("ma ya@example.com")).toBe(false);
  });
});

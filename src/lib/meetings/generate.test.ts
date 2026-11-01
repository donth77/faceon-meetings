import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { generateMeetingCode, generatePasscode } = await import("./generate");
const { MEETING_CODE_PATTERN } = await import("./codes");

describe("generateMeetingCode", () => {
  it("makes valid 10-digit IDs that never start with 0", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateMeetingCode()).toMatch(MEETING_CODE_PATTERN);
    }
  });
});

describe("generatePasscode", () => {
  it("uses 6 characters with no look-alikes", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePasscode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }
  });
});

import { describe, expect, it } from "vitest";

import { formatMeetingCode, parseMeetingInput } from "./codes";

describe("formatMeetingCode", () => {
  it("groups a valid ID as 3-3-4", () => {
    expect(formatMeetingCode("1234567890")).toBe("123 456 7890");
  });

  it("leaves anything that isn't a valid ID unchanged", () => {
    expect(formatMeetingCode("0123456789")).toBe("0123456789");
    expect(formatMeetingCode("12345")).toBe("12345");
  });
});

describe("parseMeetingInput", () => {
  it("accepts IDs typed with spaces or dashes", () => {
    expect(parseMeetingInput(" 123 456 7890 ")).toEqual({ code: "1234567890" });
    expect(parseMeetingInput("123-456-7890")).toEqual({ code: "1234567890" });
  });

  it("reads the ID and passcode from an invite link", () => {
    expect(
      parseMeetingInput("https://example.com/j/1234567890#pwd=K7XQ2M"),
    ).toEqual({
      code: "1234567890",
      passcode: "K7XQ2M",
    });
    expect(parseMeetingInput("https://example.com/j/1234567890")).toEqual({
      code: "1234567890",
    });
  });

  it("rejects input without a valid ID", () => {
    expect(parseMeetingInput("")).toBeNull();
    expect(parseMeetingInput("123 456 789")).toBeNull();
    expect(parseMeetingInput("0123456789")).toBeNull();
    expect(parseMeetingInput("https://example.com/j/12345678901")).toBeNull();
    expect(parseMeetingInput("hello")).toBeNull();
  });
});

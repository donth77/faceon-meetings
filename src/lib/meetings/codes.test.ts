import { describe, expect, it } from "vitest";

import {
  formatMeetingCode,
  formatTypedMeetingId,
  passcodeProblem,
  randomPasscode,
  readMeetingInput,
} from "./codes";
import { Passcode } from "./schedule";

describe("formatMeetingCode", () => {
  it("groups a valid ID as 3-3-4", () => {
    expect(formatMeetingCode("1234567890")).toBe("123 456 7890");
  });

  it("leaves anything that isn't a valid ID unchanged", () => {
    expect(formatMeetingCode("0123456789")).toBe("0123456789");
    expect(formatMeetingCode("12345")).toBe("12345");
  });
});

describe("formatTypedMeetingId", () => {
  /** Types `digits` one at a time at the end, as a person would. */
  function typeAtEnd(digits: string): string[] {
    let value = "";
    const shown: string[] = [];
    for (const digit of digits) {
      const next = value + digit;
      const typed = formatTypedMeetingId(next, next.length, value);
      expect(typed.caret).toBe(typed.value.length);
      value = typed.value;
      shown.push(value);
    }
    return shown;
  }

  it("groups an ID 3 3 4 as it's typed, the caret staying at the end", () => {
    expect(typeAtEnd("4815162342")).toEqual([
      "4",
      "48",
      "481",
      "481 5",
      "481 51",
      "481 516",
      "481 516 2",
      "481 516 23",
      "481 516 234",
      "481 516 2342",
    ]);
  });

  it("keeps the caret after the same digit when typing in the middle", () => {
    // A 0 typed at "123 |456 789" lands at "123 0|45 6789".
    expect(formatTypedMeetingId("123 0456 789", 5, "123 456 789")).toEqual({
      value: "123 045 6789",
      caret: 5,
    });
  });

  it("deletes the digit before a space with Backspace, not just the space", () => {
    // Backspace at "123 456 |7890" removes the space, so the 6 goes instead.
    expect(
      formatTypedMeetingId(
        "123 4567890",
        7,
        "123 456 7890",
        "deleteContentBackward",
      ),
    ).toEqual({ value: "123 457 890", caret: 6 });
    // Without an input type to go by, it's taken as Backspace.
    expect(formatTypedMeetingId("123 4567890", 7, "123 456 7890")).toEqual({
      value: "123 457 890",
      caret: 6,
    });
  });

  it("deletes the digit after a space with Delete", () => {
    // Delete at "123 456| 7890" removes the space, so the 7 goes instead.
    expect(
      formatTypedMeetingId(
        "123 4567890",
        7,
        "123 456 7890",
        "deleteContentForward",
      ),
    ).toEqual({ value: "123 456 890", caret: 7 });
  });

  it("puts back a space cut on its own, without losing a digit", () => {
    expect(formatTypedMeetingId("123456", 3, "123 456", "deleteByCut")).toEqual(
      { value: "123 456", caret: 3 },
    );
  });

  it("groups a pasted ID however it was written", () => {
    for (const pasted of ["4815162342", "481-516-2342", "481 516 2342"]) {
      expect(formatTypedMeetingId(pasted, pasted.length, "")).toEqual({
        value: "481 516 2342",
        caret: 12,
      });
    }
  });

  it("leaves links, invitations and other text exactly as typed", () => {
    for (const text of [
      "https://example.com/j/4815162342#pwd=K7XQ2M",
      "example.com/j/4815162342",
      "Meeting ID: 481 516 2342",
      "hello there",
    ]) {
      expect(formatTypedMeetingId(text, 4, "")).toEqual({
        value: text,
        caret: 4,
      });
    }
  });

  it("drops digits typed past an ID's length", () => {
    // At the end, an eleventh digit doesn't go in.
    expect(formatTypedMeetingId("123 456 78901", 13, "123 456 7890")).toEqual({
      value: "123 456 7890",
      caret: 12,
    });
    // In the middle, the ID stays as it was, and so does the caret.
    expect(formatTypedMeetingId("1523 456 7890", 2, "123 456 7890")).toEqual({
      value: "123 456 7890",
      caret: 1,
    });
    // A longer paste keeps its first ten digits.
    expect(formatTypedMeetingId("123456789012", 12, "")).toEqual({
      value: "123 456 7890",
      caret: 12,
    });
  });

  it("leaves a longer number already in the field for the person to shorten", () => {
    expect(formatTypedMeetingId("12345678901", 11, "123456789012")).toEqual({
      value: "12345678901",
      caret: 11,
    });
    expect(formatTypedMeetingId("1234567890", 10, "12345678901")).toEqual({
      value: "123 456 7890",
      caret: 12,
    });
  });

  it("reads a Japanese keyboard's full-width digits", () => {
    expect(formatTypedMeetingId("１２３４", 4, "")).toEqual({
      value: "123 4",
      caret: 5,
    });
  });

  it("drops a space typed by hand, and empties to nothing", () => {
    expect(formatTypedMeetingId("123 ", 4, "123")).toEqual({
      value: "123",
      caret: 3,
    });
    expect(formatTypedMeetingId("", 0, "1")).toEqual({ value: "", caret: 0 });
    expect(formatTypedMeetingId("1234567890", null)).toEqual({
      value: "123 456 7890",
      caret: null,
    });
  });

  it("gives a value readMeetingInput reads as the same meeting", () => {
    const { value } = formatTypedMeetingId("4815162342", 10, "");
    expect(readMeetingInput(value, ["example.com"])).toEqual({
      ok: true,
      code: "4815162342",
    });
  });
});

describe("readMeetingInput", () => {
  const hosts = ["example.com", "localhost:3000"];
  const read = (input: string) => readMeetingInput(input, hosts);
  const ok = (code: string, passcode?: string) =>
    passcode ? { ok: true, code, passcode } : { ok: true, code };
  const no = (problem: string) => ({ ok: false, problem });

  it("accepts IDs however they're grouped", () => {
    expect(read(" 123 456 7890 ")).toEqual(ok("1234567890"));
    expect(read("123-456-7890")).toEqual(ok("1234567890"));
    expect(read("123.456.7890")).toEqual(ok("1234567890"));
    expect(read("1234567890")).toEqual(ok("1234567890"));
  });

  it("says a meeting ID has 10 digits when the count is off", () => {
    expect(read("123 456 789")).toEqual(no("digits"));
    expect(read("12345678901")).toEqual(no("digits"));
    expect(read("42")).toEqual(no("digits"));
  });

  it("knows no meeting's ID starts with 0", () => {
    expect(read("012 345 6789")).toEqual(no("notFound"));
  });

  it("turns away text that's neither an ID nor a link", () => {
    expect(read("hello")).toEqual(no("notAnId"));
    expect(read("abc-defg-hij")).toEqual(no("notAnId"));
    expect(read("K7XQ2M")).toEqual(no("notAnId"));
  });

  it("reads the ID and passcode from this site's meeting links", () => {
    expect(read("https://example.com/j/1234567890#pwd=K7XQ2M")).toEqual(
      ok("1234567890", "K7XQ2M"),
    );
    expect(read("https://example.com/j/1234567890")).toEqual(ok("1234567890"));
    expect(read("https://example.com/j/1234567890/")).toEqual(ok("1234567890"));
    expect(read("example.com/j/1234567890#pwd=K7XQ2M")).toEqual(
      ok("1234567890", "K7XQ2M"),
    );
    expect(read("http://localhost:3000/j/1234567890")).toEqual(
      ok("1234567890"),
    );
    expect(read("localhost:3000/j/1234567890?pwd=K7XQ2M")).toEqual(
      ok("1234567890", "K7XQ2M"),
    );
  });

  it("reads a host's own passcode, with every character it may have", () => {
    expect(read("https://example.com/j/1234567890#pwd=Ab@_-*9")).toEqual(
      ok("1234567890", "Ab@_-*9"),
    );
  });

  it("finds the meeting in a pasted invitation", () => {
    const invitation = [
      "Tom D is inviting you to a FaceOn meeting.",
      "",
      "Weekly sync",
      "Join: https://example.com/j/1234567890#pwd=K7XQ2M.",
      "",
      "Meeting ID: 123 456 7890",
      "Passcode: K7XQ2M",
    ].join("\n");
    expect(read(invitation)).toEqual(ok("1234567890", "K7XQ2M"));
    expect(read("Meeting ID: 123 456 7890")).toEqual(ok("1234567890"));
  });

  it("says when a link belongs to another site", () => {
    expect(read("https://zoom.us/j/1234567890")).toEqual(no("otherSite"));
    expect(read("https://meet.google.com/abc-defg-hij")).toEqual(
      no("otherSite"),
    );
    // Another copy of the app: its IDs mean nothing here.
    expect(read("https://faceon.example.org/j/1234567890")).toEqual(
      no("otherSite"),
    );
  });

  it("says when a link to this site isn't a meeting's, or its ID is broken", () => {
    expect(read("https://example.com/home")).toEqual(no("notMeetingLink"));
    expect(read("https://example.com/")).toEqual(no("notMeetingLink"));
    expect(read("https://example.com/j/12345")).toEqual(no("brokenLink"));
    expect(read("https://example.com/j/0123456789")).toEqual(no("brokenLink"));
    expect(read("https://example.com/j/")).toEqual(no("brokenLink"));
  });
});

describe("passcodes", () => {
  it("are 2 to 10 letters, numbers or @ - _ *", () => {
    for (const passcode of ["FF", "K7XQ", "abcd1234@-", "team_*", "K7XQ2M"]) {
      expect(Passcode.safeParse(passcode).success).toBe(true);
    }
    for (const passcode of ["F", "abcdefghijk", "two words", "pass!", "é123"]) {
      expect(Passcode.safeParse(passcode).success).toBe(false);
    }
    expect(Passcode.parse("  K7XQ  ")).toBe("K7XQ");
  });

  it("say what's wrong with one, for its field", () => {
    expect(passcodeProblem("K7XQ2M")).toBeNull();
    expect(passcodeProblem("FF")).toBeNull();
    expect(passcodeProblem("F")).toBe("length");
    expect(passcodeProblem("abcdefghijk")).toBe("length");
    expect(passcodeProblem("pass!")).toBe("characters");
    expect(passcodeProblem("")).toBe("length");
  });

  it("are made from characters that don't look alike", () => {
    for (let i = 0; i < 200; i++) {
      const passcode = randomPasscode();
      expect(passcode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
      expect(Passcode.safeParse(passcode).success).toBe(true);
    }
  });
});

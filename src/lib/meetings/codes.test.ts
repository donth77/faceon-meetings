import { describe, expect, it } from "vitest";

import {
  formatMeetingCode,
  Passcode,
  passcodeProblem,
  randomPasscode,
  readMeetingInput,
} from "./codes";

describe("formatMeetingCode", () => {
  it("groups a valid ID as 3-3-4", () => {
    expect(formatMeetingCode("1234567890")).toBe("123 456 7890");
  });

  it("leaves anything that isn't a valid ID unchanged", () => {
    expect(formatMeetingCode("0123456789")).toBe("0123456789");
    expect(formatMeetingCode("12345")).toBe("12345");
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
  it("are 4 to 10 letters, numbers or @ - _ *", () => {
    for (const passcode of ["K7XQ", "abcd1234@-", "team_*", "K7XQ2M"]) {
      expect(Passcode.safeParse(passcode).success).toBe(true);
    }
    for (const passcode of [
      "abc",
      "abcdefghijk",
      "two words",
      "pass!",
      "é123",
    ]) {
      expect(Passcode.safeParse(passcode).success).toBe(false);
    }
    expect(Passcode.parse("  K7XQ  ")).toBe("K7XQ");
  });

  it("say what's wrong with one, for its field", () => {
    expect(passcodeProblem("K7XQ2M")).toBeNull();
    expect(passcodeProblem("abc")).toBe("length");
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

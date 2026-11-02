import { describe, expect, it } from "vitest";

import {
  APP_ROUTES,
  editMeetingPath,
  matchesRoute,
  meetingPath,
  safeRedirectPath,
  signInPath,
} from "./routes";

describe("matchesRoute", () => {
  it("matches a route and the pages below it", () => {
    expect(matchesRoute("/settings", APP_ROUTES)).toBe(true);
    expect(matchesRoute("/settings/audio", APP_ROUTES)).toBe(true);
  });

  it("doesn't match look-alike prefixes", () => {
    expect(matchesRoute("/homework", APP_ROUTES)).toBe(false);
    expect(matchesRoute("/", APP_ROUTES)).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/upcoming?view=calendar")).toBe(
      "/upcoming?view=calendar",
    );
  });

  it("falls back to /home for anything else", () => {
    expect(safeRedirectPath(null)).toBe("/home");
    expect(safeRedirectPath("")).toBe("/home");
    expect(safeRedirectPath("https://evil.example")).toBe("/home");
    expect(safeRedirectPath("//evil.example")).toBe("/home");
    expect(safeRedirectPath("/\\evil.example")).toBe("/home");
  });
});

describe("links", () => {
  it("puts a meeting's passcode in the fragment", () => {
    expect(meetingPath("1234567890", "K7XQ2M")).toBe(
      "/j/1234567890#pwd=K7XQ2M",
    );
    expect(meetingPath("1234567890", null)).toBe("/j/1234567890");
  });

  it("edits one occurrence of a repeating meeting", () => {
    expect(editMeetingPath("1234567890")).toBe("/meetings/1234567890/edit");
    expect(editMeetingPath("1234567890", "2026-11-03T15:00:00.000Z")).toBe(
      "/meetings/1234567890/edit?occurrence=2026-11-03T15%3A00%3A00.000Z",
    );
  });

  it("comes back after signing in", () => {
    expect(signInPath("/j/1234567890")).toBe("/sign-in?next=%2Fj%2F1234567890");
  });
});

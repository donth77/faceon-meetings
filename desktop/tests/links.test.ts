import { describe, expect, it } from "vitest";

import { linkInArgv, parseAppLink } from "../src/main/links";

describe("parseAppLink", () => {
  it("opens a meeting, keeping a passcode from the link", () => {
    expect(parseAppLink("faceon://j/1234567890")).toEqual({
      kind: "open",
      path: "/j/1234567890",
    });
    expect(parseAppLink("faceon://j/1234567890#pwd=K7XQ2M")).toEqual({
      kind: "open",
      path: "/j/1234567890#pwd=K7XQ2M",
    });
    expect(parseAppLink("faceon:j/1234567890")).toEqual({
      kind: "open",
      path: "/j/1234567890",
    });
  });

  it("drops a passcode it can't trust, and refuses odd meeting IDs", () => {
    expect(parseAppLink("faceon://j/1234567890#pwd=<script>")).toEqual({
      kind: "open",
      path: "/j/1234567890",
    });
    expect(parseAppLink("faceon://j/0234567890")).toBeNull();
    expect(parseAppLink("faceon://j/12345")).toBeNull();
    expect(parseAppLink("faceon://j/1234567890/extra")).toBeNull();
  });

  it("reads the sign-in hand-back only when it's well formed", () => {
    const state = "s".repeat(32);
    const token = "t".repeat(43);
    expect(parseAppLink(`faceon://auth?state=${state}&token=${token}`)).toEqual(
      {
        kind: "auth",
        state,
        token,
      },
    );
    expect(parseAppLink(`faceon://auth?state=short&token=${token}`)).toBeNull();
    expect(parseAppLink(`faceon://auth?state=${state}&token=a.b`)).toBeNull();
  });

  it("opens Home or a page by name, and nothing else", () => {
    expect(parseAppLink("faceon://")).toEqual({ kind: "open", path: "/home" });
    expect(parseAppLink("faceon://upcoming")).toEqual({
      kind: "open",
      path: "/upcoming",
    });
    expect(parseAppLink("faceon://evil.example/x")).toBeNull();
    expect(parseAppLink("faceon://api/auth")).toBeNull();
    expect(parseAppLink("https://joinfaceon.app/j/1234567890")).toBeNull();
    expect(parseAppLink("not a url")).toBeNull();
  });
});

describe("linkInArgv", () => {
  it("finds the link Windows passes to a second launch", () => {
    expect(linkInArgv(["FaceOn.exe", "--flag", "faceon://j/1234567890"])).toBe(
      "faceon://j/1234567890",
    );
    expect(linkInArgv(["FaceOn.exe"])).toBeUndefined();
  });
});

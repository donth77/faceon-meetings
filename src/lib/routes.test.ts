import { describe, expect, it } from "vitest";

import { APP_ROUTES, matchesRoute, safeRedirectPath } from "./routes";

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

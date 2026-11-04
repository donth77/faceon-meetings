import { afterEach, describe, expect, it, vi } from "vitest";

import { linkParam } from "./link-params";

describe("linkParam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a parameter of this page's link", () => {
    vi.stubGlobal("window", {
      location: { search: "?next=%2Fj%2F1234567890&error=" },
    });
    expect(linkParam("next")).toBe("/j/1234567890");
    // Present but empty still counts: ?error= says a sign-in came back.
    expect(linkParam("error")).toBe("");
    expect(linkParam("email")).toBeNull();
  });
});

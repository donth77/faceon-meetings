import { describe, expect, it } from "vitest";

import { repoHomeUrl } from "./repo";

describe("repoHomeUrl", () => {
  it("opens the repository at its README's title", () => {
    expect(repoHomeUrl("https://github.com/donth77/faceon-meetings")).toBe(
      "https://github.com/donth77/faceon-meetings#faceon-meetings",
    );
  });

  it("ignores a trailing slash and capitals in the name", () => {
    expect(repoHomeUrl("https://github.com/someone/Acme-Meet/")).toBe(
      "https://github.com/someone/Acme-Meet#acme-meet",
    );
  });

  it("keeps an anchor the address already has", () => {
    expect(repoHomeUrl("https://github.com/someone/meet#readme")).toBe(
      "https://github.com/someone/meet#readme",
    );
  });

  it("adds no anchor GitHub wouldn't make", () => {
    expect(repoHomeUrl("https://github.com/someone/my.repo")).toBe(
      "https://github.com/someone/my.repo",
    );
  });
});

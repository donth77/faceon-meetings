import { describe, expect, it } from "vitest";

import { lookForName } from "./name-look";
import {
  avatarUrl,
  createAvatarSeed,
  fallbackAvatarSeed,
  parseAvatarSeed,
} from "./seed";

describe("lookForName", () => {
  it("uses the first name, ignoring case and accents", () => {
    expect(lookForName("Ana López")).toBe("f");
    expect(lookForName("chloé")).toBe("f");
    expect(lookForName("Ben Okafor")).toBe("m");
  });

  it("gives unisex and unknown names the full mix", () => {
    expect(lookForName("Jordan Lee")).toBe("n");
    expect(lookForName("Taylor")).toBe("n");
    expect(lookForName("真央")).toBe("n");
    expect(lookForName("")).toBe("n");
  });
});

describe("avatar seeds", () => {
  it("round-trips a created seed", () => {
    const seed = createAvatarSeed(lookForName("Maya"));
    expect(parseAvatarSeed(seed)).toEqual({
      seed: seed.slice(0, 16),
      look: "f",
    });
  });

  it("rejects anything that isn't a seed", () => {
    expect(parseAvatarSeed("../etc/passwd")).toBeNull();
    expect(parseAvatarSeed("abc-f")).toBeNull();
    expect(parseAvatarSeed("0123456789abcdef-x")).toBeNull();
  });

  it("gives older accounts a stable, valid fallback", () => {
    const seed = fallbackAvatarSeed("user_123");
    expect(seed).toBe(fallbackAvatarSeed("user_123"));
    expect(parseAvatarSeed(seed)?.look).toBe("n");
  });
});

describe("avatarUrl", () => {
  it("prefers the provider photo only when chosen", () => {
    const user = { id: "u1", image: "https://example.com/p.png" };
    expect(avatarUrl({ ...user, avatarSource: "provider" })).toBe(user.image);
    expect(
      avatarUrl({ ...user, avatarSource: "dicebear", avatarSeed: "s" }),
    ).toBe("/avatar/s.svg");
  });
});

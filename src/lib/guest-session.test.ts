import { describe, expect, it } from "vitest";

import { guestForJoin } from "./guest-session";

describe("guestForJoin", () => {
  const returning = {
    id: "0123456789abcdef0123",
    avatarSeed: "aaaaaaaaaaaaaaaa-n",
  };

  it("makes a first-time guest with the avatar the join screen showed", () => {
    const guest = guestForJoin(null, {
      name: "Ana López",
      avatarSeed: "bbbbbbbbbbbbbbbb-m",
    });
    expect(guest.id).toMatch(/^[a-f0-9]{20}$/);
    expect(guest.avatarSeed).toBe("bbbbbbbbbbbbbbbb-m");
  });

  it("gives a first-time guest without one a default that suits their name", () => {
    expect(guestForJoin(null, { name: "Ana López" }).avatarSeed).toMatch(
      /^[a-z0-9]{16}-f$/,
    );
    expect(guestForJoin(null, { name: "Ben" }).avatarSeed).toMatch(/-m$/);
  });

  it("keeps a returning guest's ID, with the avatar they chose this time", () => {
    expect(
      guestForJoin(returning, {
        name: "Ana",
        avatarSeed: "cccccccccccccccc-f",
      }),
    ).toEqual({ id: returning.id, avatarSeed: "cccccccccccccccc-f" });
  });

  it("leaves a returning guest as they were when nothing new comes", () => {
    expect(guestForJoin(returning, { name: "Ana" })).toEqual(returning);
  });
});

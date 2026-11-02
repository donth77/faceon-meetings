import { describe, expect, it } from "vitest";

import { invitationRows } from "./invitations";

describe("invitationRows", () => {
  const rows = (invitees: string[], cohosts: string[]) =>
    invitationRows("m1", invitees, cohosts, 1_000).map(
      ({ email, cohost, addedAt }) => [email, cohost, addedAt.getTime()],
    );

  it("keeps everyone in the order they were added, co-hosts in their place", () => {
    expect(rows(["ana@x.io", "ben@x.io", "cy@x.io"], ["ben@x.io"])).toEqual([
      ["ana@x.io", false, 1_000],
      ["ben@x.io", true, 1_001],
      ["cy@x.io", false, 1_002],
    ]);
  });

  it("lists each person once, and adds co-hosts named only as co-hosts after", () => {
    expect(rows(["ana@x.io", "ana@x.io"], ["dee@x.io"])).toEqual([
      ["ana@x.io", false, 1_000],
      ["dee@x.io", true, 1_001],
    ]);
  });
});

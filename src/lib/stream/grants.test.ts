import { describe, expect, it } from "vitest";

import { BUILT_IN_CALL_TYPES, EXPECTED_GRANTS, grantsDrift } from "./grants";

/** Stream's call types as FaceOn sets them up, in Stream's own shape: a copy to change. */
const asSetUp = () =>
  Object.fromEntries(
    Object.entries(EXPECTED_GRANTS).map(([name, grants]) => [
      name,
      {
        grants: Object.fromEntries(
          Object.entries(grants).map(([role, list]) => [role, [...list]]),
        ),
      },
    ]),
  );

describe("the call types' permissions against FaceOn's setup", () => {
  it("finds nothing when they match, in any order", () => {
    const live = asSetUp();
    live.meeting!.grants.host = [...live.meeting!.grants.host!].reverse();
    expect(grantsDrift(live)).toEqual([]);
  });

  it("ignores roles FaceOn doesn't set up", () => {
    const live = asSetUp();
    live.meeting!.grants.admin = ["read-call"];
    expect(grantsDrift(live)).toEqual([]);
  });

  it("names a role given more than everyone's", () => {
    const live = asSetUp();
    live.meeting!.grants.host!.push("end-call");
    expect(grantsDrift(live)).toEqual([
      { callType: "meeting", missing: false, roles: ["host"] },
    ]);
  });

  it("names outsiders given any access, and roles missing their grants", () => {
    const live = asSetUp();
    live.meeting!.grants.user = ["join-call"];
    delete live.meeting!.grants.cohost;
    live.default!.grants.guest = ["read-call"];
    expect(grantsDrift(live)).toEqual([
      { callType: "meeting", missing: false, roles: ["user", "cohost"] },
      { callType: "default", missing: false, roles: ["guest"] },
    ]);
  });

  it("names a call type Stream doesn't have", () => {
    const live = asSetUp();
    delete live.meeting;
    expect(grantsDrift(live)).toEqual([
      {
        callType: "meeting",
        missing: true,
        roles: ["call_member", "cohost", "host"],
      },
    ]);
  });

  it("keeps Stream's own call types locked", () => {
    for (const name of BUILT_IN_CALL_TYPES) {
      expect(Object.values(EXPECTED_GRANTS[name]!).flat()).toEqual([]);
    }
  });
});

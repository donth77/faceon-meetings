import { describe, expect, it } from "vitest";

import { withheldFrom, type SessionPolicy } from "./policy";

const open: SessionPolicy = {
  locked: false,
  waitingRoom: false,
  chat: true,
  reactions: true,
  screenShare: "all",
  selfUnmute: true,
};

describe("withheldFrom", () => {
  it("withholds nothing when participants may do everything", () => {
    expect(withheldFrom(open)).toBeNull();
  });

  it("withholds the mic without self-unmute", () => {
    expect(withheldFrom({ ...open, selfUnmute: false })).toEqual({
      audio: false,
    });
  });

  it("withholds screen sharing when it's for hosts", () => {
    expect(withheldFrom({ ...open, screenShare: "host" })).toEqual({
      screen: false,
    });
  });

  it("withholds both together", () => {
    expect(
      withheldFrom({ ...open, selfUnmute: false, screenShare: "host" }),
    ).toEqual({ audio: false, screen: false });
  });
});

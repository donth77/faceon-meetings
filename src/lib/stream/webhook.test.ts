import { describe, expect, it } from "vitest";

import { parseStreamWebhook } from "./webhook";

const SESSION = "4f3c2b1a-0e9d-4c8b-a7f6-5e4d3c2b1a09";

const joined = {
  type: "call.session_participant_joined",
  call_cid: `meeting:${SESSION}`,
  created_at: "2026-11-02T10:00:05.123456Z",
  participant: {
    user_session_id: "conn-1",
    joined_at: "2026-11-02T10:00:04.5Z",
    user: { id: "u_abc", name: "Ada", image: "https://example.com/a.png" },
  },
};

describe("parseStreamWebhook", () => {
  it("reads someone joining", () => {
    expect(parseStreamWebhook(joined)).toEqual({
      type: "joined",
      sessionId: SESSION,
      connectionId: "conn-1",
      mediaUserId: "u_abc",
      name: "Ada",
      image: "https://example.com/a.png",
      at: new Date("2026-11-02T10:00:04.5Z"),
    });
  });

  it("reads someone leaving", () => {
    expect(
      parseStreamWebhook({
        ...joined,
        type: "call.session_participant_left",
      }),
    ).toEqual({
      type: "left",
      sessionId: SESSION,
      connectionId: "conn-1",
      at: new Date("2026-11-02T10:00:05.123456Z"),
    });
  });

  it("names someone by their ID when they have no name", () => {
    const event = parseStreamWebhook({
      ...joined,
      participant: { ...joined.participant, user: { id: "g_xyz" } },
    });
    expect(event).toMatchObject({ name: "g_xyz", image: null });
  });

  it("uses the time it arrived when Stream's times are unreadable", () => {
    const before = Date.now();
    const event = parseStreamWebhook({
      ...joined,
      created_at: "yesterday",
      participant: { ...joined.participant, joined_at: 42 },
    });
    expect(event?.at.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("ignores other calls, other events and malformed bodies", () => {
    expect(
      parseStreamWebhook({ ...joined, call_cid: `default:${SESSION}` }),
    ).toBeNull();
    expect(
      parseStreamWebhook({ ...joined, call_cid: "meeting:not-a-session" }),
    ).toBeNull();
    expect(
      parseStreamWebhook({ ...joined, type: "call.session_started" }),
    ).toBeNull();
    expect(parseStreamWebhook({ type: "call.ended" })).toBeNull();
    expect(parseStreamWebhook(null)).toBeNull();
    expect(parseStreamWebhook("text")).toBeNull();
  });
});

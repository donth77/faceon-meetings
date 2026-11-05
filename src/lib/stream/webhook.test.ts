import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  parseStreamWebhook,
  refusedDelivery,
  signedWebhookBody,
} from "./webhook";

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

describe("signedWebhookBody", () => {
  const json = Buffer.from(JSON.stringify(joined));

  it("keeps a body Stream sent as it is", () => {
    expect(signedWebhookBody(json)).toEqual(json);
  });

  it("unzips a body Stream gzipped", () => {
    expect(signedWebhookBody(gzipSync(json))).toEqual(json);
  });

  it("has nothing for a broken gzip, or one that unzips past 1 MB", () => {
    expect(signedWebhookBody(Buffer.from([0x1f, 0x8b, 1, 2, 3]))).toBeNull();
    expect(
      signedWebhookBody(gzipSync(Buffer.alloc(2 * 1024 * 1024))),
    ).toBeNull();
    expect(signedWebhookBody(Buffer.alloc(2 * 1024 * 1024, " "))).toBeNull();
  });
});

describe("refusedDelivery", () => {
  it("says what a delivery looked like, not what it held", () => {
    const body = gzipSync(Buffer.from(JSON.stringify(joined)));
    const details = refusedDelivery(
      new Headers({
        "user-agent": "Go-http-client/1.1",
        "content-encoding": "gzip",
        "x-signature": "a".repeat(64),
        "x-api-key": "key-1",
        "x-webhook-id": "d-1",
        "x-forwarded-for": "203.0.113.9",
        "x-vercel-id": "iad1::abc",
      }),
      body,
      "key-1",
    );
    expect(details).toEqual({
      bytes: body.length,
      gzipped: "yes",
      encoding: "gzip",
      signature: "sha256 hex",
      api_key: "ours",
      headers: "x-api-key x-signature x-webhook-id",
      agent: "Go-http-client",
    });
  });

  it("tells a delivery from another app or nobody apart", () => {
    expect(
      refusedDelivery(
        new Headers({ "x-signature": "sha256=abc", "x-api-key": "key-2" }),
        Buffer.from("{}"),
        "key-1",
      ),
    ).toMatchObject({
      gzipped: "no",
      encoding: "none",
      signature: "other, 10 characters",
      api_key: "another",
    });
    expect(
      refusedDelivery(new Headers(), Buffer.from(""), "key-1"),
    ).toMatchObject({
      signature: "none",
      api_key: "none",
      headers: "none",
      agent: "none",
    });
  });
});

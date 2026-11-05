import { createHmac } from "node:crypto";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-stream-secret";
const KEY = "test-stream-key";
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_STREAM_API_KEY = "test-stream-key";
  process.env.STREAM_API_SECRET = "test-stream-secret";
});

const recordAttendance = vi.hoisted(() => vi.fn());
const reportError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meetings/attendance", () => ({
  recordAttendance,
  tidyUpAfterLeaving: vi.fn(async () => {}),
}));
vi.mock("@/lib/monitoring/report", () => ({ reportError }));

const { POST } = await import("./route");

const SESSION = "4f3c2b1a-0e9d-4c8b-a7f6-5e4d3c2b1a09";
const joined = JSON.stringify({
  type: "call.session_participant_joined",
  call_cid: `meeting:${SESSION}`,
  created_at: "2026-11-04T18:20:21.123456789Z",
  session_id: "7b6633e2",
  participant: {
    user_session_id: "conn-1",
    role: "user",
    joined_at: "2026-11-04T18:20:21.1Z",
    user: { id: "u_abc", name: "Ada" },
  },
});
const sign = (json: string) =>
  createHmac("sha256", SECRET).update(json).digest("hex");
const deliver = (body: string | Buffer, headers: Record<string, string>) =>
  POST(
    new Request("https://joinfaceon.app/api/webhooks/stream", {
      method: "POST",
      headers: { "x-api-key": KEY, "x-webhook-id": "d-1", ...headers },
      body: new Uint8Array(Buffer.from(body)),
    }),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  recordAttendance.mockReset().mockResolvedValue("recorded");
  reportError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/webhooks/stream", () => {
  it("records someone joining, from a delivery signed with our secret", async () => {
    const response = await deliver(joined, { "x-signature": sign(joined) });
    expect(response.status).toBe(200);
    expect(recordAttendance).toHaveBeenCalledWith(
      "d-1",
      expect.objectContaining({ type: "joined", sessionId: SESSION }),
    );
  });

  it("reads a delivery Stream gzipped, signed before it was", async () => {
    const response = await deliver(gzipSync(joined), {
      "x-signature": sign(joined),
      "content-encoding": "gzip",
    });
    expect(response.status).toBe(200);
    expect(recordAttendance).toHaveBeenCalledWith(
      "d-1",
      expect.objectContaining({ type: "joined", connectionId: "conn-1" }),
    );
  });

  it("turns away a delivery not signed with our secret, saying so once an hour", async () => {
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    const forged = { "x-signature": "0".repeat(64) };
    expect((await deliver(joined, forged)).status).toBe(401);
    expect((await deliver(joined, {})).status).toBe(401);
    expect(recordAttendance).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ api_key: "ours", signature: "sha256 hex" }),
    );
    expect(JSON.stringify(reportError.mock.calls)).not.toMatch(/Ada|u_abc/);

    vi.setSystemTime(new Date("2026-11-05T11:00:00Z"));
    expect((await deliver(joined, forged)).status).toBe(401);
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("answers 400 for a signed body that isn't JSON", async () => {
    const response = await deliver("not json", {
      "x-signature": sign("not json"),
    });
    expect(response.status).toBe(400);
    expect(recordAttendance).not.toHaveBeenCalled();
  });
});

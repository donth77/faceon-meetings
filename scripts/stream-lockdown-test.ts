/**
 * Proves the Stream permission boundary that FaceOn relies on, against a real Stream app.
 * A signed-in user's token must not create calls or read calls it isn't a member of, while a
 * member can read its call, send custom events (chat) and send reactions.
 *
 * Usage: node --env-file=.env.local scripts/stream-lockdown-test.ts   (exit code 1 on any failure)
 * It only makes REST calls (no media), so it uses no participant-minutes.
 */
import { randomUUID } from "node:crypto";
import { StreamClient } from "@stream-io/node-sdk";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;
if (!apiKey || !secret) {
  console.error("Set NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET first.");
  process.exit(1);
}

const server = new StreamClient(apiKey, secret);
const BASE = "https://video.stream-io-api.com";
const systemUserId = process.env.STREAM_SYSTEM_USER_ID || "system";
const outsiderId = "lockdown_outsider";
const memberId = "lockdown_member";
const callId = `lockdown-${randomUUID()}`;

await server.upsertUsers([
  { id: outsiderId, name: "Lockdown outsider", role: "user" },
  { id: memberId, name: "Lockdown member", role: "user" },
]);
const meetingCall = server.video.call("meeting", callId);
await meetingCall.getOrCreate({
  data: {
    created_by_id: systemUserId,
    members: [{ user_id: memberId, role: "call_member" }],
  },
});

const tokenFor = (userId: string) =>
  server.generateUserToken({ user_id: userId, validity_in_seconds: 600 });

/** Calls Stream's client-side REST API as the given user. Returns the HTTP status. */
async function asUser(
  userId: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) {
  const res = await fetch(`${BASE}${path}?api_key=${apiKey}`, {
    method,
    headers: {
      Authorization: tokenFor(userId),
      "stream-auth-type": "jwt",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.status;
}

const ok = (status: number) => status >= 200 && status < 300;
const checks: Array<[string, boolean]> = [];
const expect = async (
  label: string,
  run: Promise<number>,
  wantAllowed: boolean,
) => {
  const status = await run;
  checks.push([`${label} → ${status}`, ok(status) === wantAllowed]);
};

await expect(
  "outsider creates a 'default' call",
  asUser(outsiderId, "POST", `/video/call/default/${randomUUID()}`, {}),
  false,
);
await expect(
  "outsider creates a 'meeting' call",
  asUser(outsiderId, "POST", `/video/call/meeting/${randomUUID()}`, {}),
  false,
);
await expect(
  "outsider reads someone else's meeting",
  asUser(outsiderId, "GET", `/video/call/meeting/${callId}`),
  false,
);
await expect(
  "outsider sends an event into it",
  asUser(outsiderId, "POST", `/video/call/meeting/${callId}/event`, {
    custom: { type: "lockdown.ping" },
  }),
  false,
);
await expect(
  "member reads its meeting",
  asUser(memberId, "GET", `/video/call/meeting/${callId}`),
  true,
);
await expect(
  "member sends a custom event (chat)",
  asUser(memberId, "POST", `/video/call/meeting/${callId}/event`, {
    custom: { type: "lockdown.ping" },
  }),
  true,
);
await expect(
  "member sends a reaction",
  asUser(memberId, "POST", `/video/call/meeting/${callId}/reaction`, {
    type: "reaction",
    emoji_code: ":like:",
  }),
  true,
);

await meetingCall.end().catch(() => undefined);

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed++;
}
console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);

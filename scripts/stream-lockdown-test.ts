/**
 * Proves the Stream permission boundary that FaceOn relies on, against a real Stream app.
 * A signed-in user's token must not create calls or read calls it isn't a member of, while a
 * member can read its call, send custom events (chat) and send reactions. Hosts and
 * co-hosts can't moderate through Stream directly (only through FaceOn's API, which
 * checks the rules): a co-host can't mute, remove or block the host, and the host can't
 * change the call's shared state or end it from the browser.
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
const cohostId = "lockdown_cohost";
const hostId = "lockdown_host";
const callId = `lockdown-${randomUUID()}`;

await server.upsertUsers([
  { id: outsiderId, name: "Lockdown outsider", role: "user" },
  { id: memberId, name: "Lockdown member", role: "user" },
  { id: cohostId, name: "Lockdown co-host", role: "user" },
  { id: hostId, name: "Lockdown host", role: "user" },
]);
const meetingCall = server.video.call("meeting", callId);
await meetingCall.getOrCreate({
  data: {
    created_by_id: systemUserId,
    members: [
      { user_id: memberId, role: "call_member" },
      { user_id: cohostId, role: "cohost" },
      { user_id: hostId, role: "host" },
    ],
  },
});

const tokenFor = (userId: string) =>
  server.generateUserToken({ user_id: userId, validity_in_seconds: 600 });

/** Calls Stream's client-side REST API as the given user. Returns the HTTP status. */
async function asUser(
  userId: string,
  method: "GET" | "POST" | "PATCH",
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
/** Refused for lack of permission (403), not for some other reason. */
const refused = async (label: string, run: Promise<number>) => {
  const status = await run;
  checks.push([`${label} → ${status}`, status === 403]);
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

const call = `/video/call/meeting/${callId}`;
await refused(
  "co-host mutes the host",
  asUser(cohostId, "POST", `${call}/mute_users`, {
    user_ids: [hostId],
    audio: true,
  }),
);
await refused(
  "co-host removes the host",
  asUser(cohostId, "POST", `${call}/kick`, { user_id: hostId }),
);
await refused(
  "co-host blocks the host",
  asUser(cohostId, "POST", `${call}/block`, { user_id: hostId }),
);
await refused(
  "co-host takes the host's mic away",
  asUser(cohostId, "POST", `${call}/user_permissions`, {
    user_id: hostId,
    revoke_permissions: ["send-audio"],
  }),
);
await refused(
  "host removes a co-host from the browser",
  asUser(hostId, "POST", `${call}/kick`, { user_id: cohostId }),
);
await refused(
  "host rewrites the shared state from the browser",
  asUser(hostId, "PATCH", call, { custom: { v: 1, spotlight: memberId } }),
);
await refused(
  "host ends the call from the browser",
  asUser(hostId, "POST", `${call}/mark_ended`, {}),
);

await meetingCall.end().catch(() => undefined);

let failed = 0;
for (const [label, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}`);
  if (!passed) failed++;
}
console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);

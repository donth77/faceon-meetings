/**
 * Sets up Stream Video for FaceOn. It is idempotent, so it's safe to run again.
 *
 * - The `meeting` call type: non-members get no grants; members, co-hosts and hosts get theirs.
 * - Stream's built-in call types are locked down. Call tokens add access rather than confine
 *   it, so only call grants keep a user's token from reaching other calls.
 * - The `system` user, which sends server events.
 * - With STREAM_WEBHOOK_URL set, the app's webhook (attendance for Previous), for example
 *   https://joinfaceon.vercel.app/api/webhooks/stream. Stream can't reach localhost.
 *
 * Usage:
 *   node --env-file=.env.local scripts/setup-stream.ts           apply
 *   node --env-file=.env.local scripts/setup-stream.ts --check   report drift only (exit code 1 on drift)
 *
 * The `cohost` role must already exist (Stream dashboard → Roles & Permissions).
 */
import { StreamClient } from "@stream-io/node-sdk";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;
if (!apiKey || !secret) {
  console.error("Set NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET first.");
  process.exit(1);
}

const checkOnly = process.argv.includes("--check");
const client = new StreamClient(apiKey, secret);

// Grant names (not capability names): reactions are "create-call-reaction", chat and other custom
// events need "send-event", and "pin-call-track" is spotlight (pin for everyone).
const MEMBER = [
  "read-call",
  "join-call",
  "send-audio",
  "send-video",
  "screenshare",
  "create-call-reaction",
  "send-event",
];
const COHOST = [
  ...MEMBER,
  "mute-users",
  "pin-call-track",
  "update-call-permissions",
  "kick-user",
  "block-user",
];
const HOST = [
  ...COHOST,
  "end-call",
  "update-call",
  "update-call-settings",
  "update-call-member",
  "update-call-member-role",
  "remove-call-member",
];
const OUTSIDERS: Record<string, string[]> = {
  user: [],
  guest: [],
  anonymous: [],
};
const BUILT_IN = ["default", "audio_room", "livestream", "development"];

const expected: Record<string, Record<string, string[]>> = {
  meeting: { ...OUTSIDERS, call_member: MEMBER, cohost: COHOST, host: HOST },
  ...Object.fromEntries(BUILT_IN.map((name) => [name, OUTSIDERS])),
};

/** Each session's call overrides this with its own full or demo limits. */
const MEETING_SETTINGS = { limits: { max_participants: 20 } };

const sorted = (list: string[] | undefined) =>
  [...(list ?? [])].sort().join(",");

const { call_types: live } = await client.video.listCallTypes();
let drift = 0;

for (const [name, grants] of Object.entries(expected)) {
  const current = live[name]?.grants ?? {};
  const differing = Object.keys(grants).filter(
    (role) => sorted(current[role]) !== sorted(grants[role]),
  );
  const missing = !live[name];

  if (!missing && differing.length === 0) {
    console.log(`ok       ${name}`);
    continue;
  }
  drift++;
  console.log(
    `${missing ? "missing " : "drift   "} ${name}${differing.length ? ` (roles: ${differing.join(", ")})` : ""}`,
  );
  if (checkOnly) continue;

  if (missing && name === "meeting") {
    await client.video.createCallType({
      name,
      grants,
      settings: MEETING_SETTINGS,
    });
  } else if (!missing) {
    await client.video.updateCallType({
      name,
      grants,
      ...(name === "meeting" ? { settings: MEETING_SETTINGS } : {}),
    });
  }
  console.log(`fixed    ${name}`);
}

const systemUserId = process.env.STREAM_SYSTEM_USER_ID || "system";
if (!checkOnly) {
  await client.upsertUsers([
    { id: systemUserId, name: "FaceOn", role: "admin" },
  ]);
  console.log(`ok       user "${systemUserId}"`);
}

const webhookUrl = process.env.STREAM_WEBHOOK_URL;
if (webhookUrl && !checkOnly) {
  // Stream's event hooks: keep any others, and (re)place ours.
  const { app } = await client.getApp();
  const others = (app.event_hooks ?? []).filter(
    (hook) => hook.webhook_url !== webhookUrl,
  );
  await client.updateApp({
    event_hooks: [
      ...others,
      {
        hook_type: "webhook",
        enabled: true,
        product: "video",
        webhook_url: webhookUrl,
        event_types: [
          "call.session_participant_joined",
          "call.session_participant_left",
        ],
      },
    ],
  });
  console.log(`ok       webhook → ${webhookUrl}`);
}

if (checkOnly && drift > 0) process.exit(1);

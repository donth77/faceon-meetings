/**
 * Sets up Stream Video for FaceOn. It is idempotent, so it's safe to run again.
 *
 * - The `meeting` call type: non-members get no grants; members, co-hosts and hosts get the
 *   same member grants (host controls go through FaceOn's API). Its media settings (camera
 *   and screen resolutions and bitrates, audio) are FaceOn's (call-settings.ts).
 * - Stream's built-in call types are locked down. Call tokens add access rather than confine
 *   it, so only call grants keep a user's token from reaching other calls.
 * - The `system` user, which sends server events.
 * - With STREAM_WEBHOOK_URL set, the app's webhook (attendance for Previous), for example
 *   https://faceon.example.com/api/webhooks/stream. Stream can't reach localhost. A new
 *   domain replaces the old one's webhook.
 *
 * Usage:
 *   node --env-file=.env.local scripts/setup-stream.ts           apply
 *   node --env-file=.env.local scripts/setup-stream.ts --check   report drift only (exit code 1 on drift)
 *
 * The `cohost` role must already exist (Stream dashboard → Roles & Permissions).
 */
import { StreamClient } from "@stream-io/node-sdk";

import {
  MEETING_SETTINGS,
  settingsDrift,
} from "../src/lib/stream/call-settings.ts";
import { EXPECTED_GRANTS, grantsDrift } from "../src/lib/stream/grants.ts";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;
if (!apiKey || !secret) {
  console.error("Set NEXT_PUBLIC_STREAM_API_KEY and STREAM_API_SECRET first.");
  process.exit(1);
}

const checkOnly = process.argv.includes("--check");
const client = new StreamClient(apiKey, secret);

const { call_types: live } = await client.video.listCallTypes();
const drifted = grantsDrift(live);
const settingsDrifted = settingsDrift(live.meeting?.settings);

for (const [name, grants] of Object.entries(EXPECTED_GRANTS)) {
  const drift = drifted.find((found) => found.callType === name);
  const settings = name === "meeting" ? settingsDrifted : [];
  if (!drift && settings.length === 0) {
    console.log(`ok       ${name}`);
    continue;
  }
  const details = [
    drift?.roles.length ? `roles: ${drift.roles.join(", ")}` : "",
    settings.length > 0 && !drift?.missing
      ? `settings: ${settings.join(", ")}`
      : "",
  ].filter(Boolean);
  console.log(
    `${drift?.missing ? "missing " : "drift   "} ${name}${details.length ? ` (${details.join("; ")})` : ""}`,
  );
  if (checkOnly) continue;

  if (drift?.missing && name === "meeting") {
    await client.video.createCallType({
      name,
      grants,
      settings: MEETING_SETTINGS,
    });
  } else if (!drift?.missing) {
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
    {
      id: systemUserId,
      name: process.env.NEXT_PUBLIC_APP_NAME || "FaceOn",
      role: "admin",
    },
  ]);
  console.log(`ok       user "${systemUserId}"`);
}

const webhookUrl = process.env.STREAM_WEBHOOK_URL;
if (webhookUrl && !checkOnly) {
  // Stream's event hooks: keep any others, and (re)place ours, found by its path on any domain.
  const ourPath = new URL(webhookUrl).pathname;
  const isOurs = (url: string | undefined) =>
    !!url && URL.canParse(url) && new URL(url).pathname === ourPath;
  const { app } = await client.getApp();
  const others = (app.event_hooks ?? []).filter(
    (hook) => !isOurs(hook.webhook_url),
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

if (checkOnly && (drifted.length > 0 || settingsDrifted.length > 0)) {
  process.exit(1);
}

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/server-env";

import { generateMeetingCode, generatePasscode } from "./generate";
import { DAY_MS } from "./retention";
import type { ScheduleDraft } from "./schedule";

const sign = (payload: string) => {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret)
    .update(`schedule-draft:${payload}`)
    .digest("base64url");
};

/**
 * A meeting ID and passcode for the schedule page to preview before saving, signed so a
 * client can't choose its own. Good for a day. Server-only: it's never an action.
 */
export function newScheduleDraft(): ScheduleDraft {
  const code = generateMeetingCode();
  const passcode = generatePasscode();
  const expires = Date.now() + DAY_MS;
  return {
    code,
    passcode,
    token: `${expires}.${sign(`${code}.${passcode}.${expires}`)}`,
  };
}

/** The draft is one we signed, and it's still fresh. */
export function draftIsValid(draft: ScheduleDraft): boolean {
  const [expires = "", mac = ""] = draft.token.split(".");
  if (!(Number(expires) >= Date.now())) return false;
  const expected = Buffer.from(
    sign(`${draft.code}.${draft.passcode}.${expires}`),
  );
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

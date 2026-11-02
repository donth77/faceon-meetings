"use server";

import { requireSession } from "@/lib/auth/session";
import { HOME_ROUTE, PERSONAL_ROOM_ROUTE } from "@/lib/routes";
import { serverEnv } from "@/lib/server-env";

import {
  countMeetingsCreatedSince,
  getOrCreatePersonalRoom,
  insertInstantMeeting,
  rotatePersonalRoomCode,
  updateMeetingSettings,
} from "./queries";
import { demoMeetingsLeft } from "./sessions";
import { MeetingSettings } from "./settings";

export type CreatedMeeting =
  | { ok: true; code: string; passcode: string | null }
  /** Too many meetings made today, or (starting one now) no demo meetings left today. */
  | { ok: false; reason: "dailyLimit" | "demoLimit"; limit: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * New meeting → Start an instant meeting, or Create a meeting for later: a fresh meeting
 * hosted by the caller. The menu opens it or shows its link. Accounts can create a
 * limited number a day, so bots can't burn the free media credit; starting one now also
 * needs a demo meeting left today, checked here so the host hears it before anything.
 */
export async function createInstantMeeting(
  options: { start?: boolean } = {},
): Promise<CreatedMeeting> {
  const session = await requireSession(HOME_ROUTE);
  const env = serverEnv();
  const now = new Date();
  const today = await countMeetingsCreatedSince(
    session.user.id,
    new Date(now.getTime() - DAY_MS),
  );
  if (today >= env.MEETINGS_PER_USER_PER_DAY) {
    return {
      ok: false,
      reason: "dailyLimit",
      limit: env.MEETINGS_PER_USER_PER_DAY,
    };
  }
  if (options.start && (await demoMeetingsLeft(session.user, now)) === 0) {
    return {
      ok: false,
      reason: "demoLimit",
      limit: env.DEMO_MEETINGS_PER_DAY,
    };
  }
  const meeting = await insertInstantMeeting(session.user.id);
  return { ok: true, code: meeting.code, passcode: meeting.passcode };
}

/** Personal room → Regenerate ID: a new Personal Meeting ID and passcode. */
export async function regeneratePersonalRoom(): Promise<{
  code: string;
  passcode: string | null;
}> {
  const session = await requireSession(PERSONAL_ROOM_ROUTE);
  const room = await rotatePersonalRoomCode(session.user.id);
  return { code: room.code, passcode: room.passcode };
}

/** The personal room settings a host can change here. */
const PersonalRoomChanges = MeetingSettings.pick({
  waitingRoom: true,
  allowGuests: true,
  muteOnEntry: true,
  autoNotes: true,
}).partial();

/** False when the changes aren't settings this page has, as the other actions do. */
export async function updatePersonalRoomSettings(
  changes: unknown,
): Promise<boolean> {
  const session = await requireSession(PERSONAL_ROOM_ROUTE);
  const parsed = PersonalRoomChanges.safeParse(changes);
  if (!parsed.success) return false;
  const room = await getOrCreatePersonalRoom(session.user.id);
  await updateMeetingSettings(room.id, session.user.id, parsed.data);
  return true;
}

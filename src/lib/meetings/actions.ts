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
import { MeetingSettings } from "./settings";

export type CreatedMeeting =
  | { ok: true; code: string; passcode: string | null }
  | { ok: false; reason: "dailyLimit" };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * New meeting → Start an instant meeting, or Create a meeting for later: a fresh meeting
 * hosted by the caller. The menu opens it or shows its link. Accounts can create a
 * limited number a day, so bots can't burn the free media credit.
 */
export async function createInstantMeeting(): Promise<CreatedMeeting> {
  const session = await requireSession(HOME_ROUTE);
  const today = await countMeetingsCreatedSince(
    session.user.id,
    new Date(Date.now() - DAY_MS),
  );
  if (today >= serverEnv().MEETINGS_PER_USER_PER_DAY) {
    return { ok: false, reason: "dailyLimit" };
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
  allowGuests: true,
  muteOnEntry: true,
}).partial();

export async function updatePersonalRoomSettings(
  changes: unknown,
): Promise<void> {
  const session = await requireSession(PERSONAL_ROOM_ROUTE);
  const room = await getOrCreatePersonalRoom(session.user.id);
  await updateMeetingSettings(
    room.id,
    session.user.id,
    PersonalRoomChanges.parse(changes),
  );
}

"use server";

import { requireSession } from "@/lib/auth/session";
import { HOME_ROUTE, PERSONAL_ROOM_ROUTE } from "@/lib/routes";

import {
  getOrCreatePersonalRoom,
  insertInstantMeeting,
  rotatePersonalRoomCode,
  updateMeetingSettings,
} from "./queries";
import { MeetingSettings } from "./settings";

/**
 * New meeting → Start an instant meeting, or Create a meeting for later: a fresh meeting
 * hosted by the caller. The menu opens it or shows its link.
 */
export async function createInstantMeeting(): Promise<{
  code: string;
  passcode: string | null;
}> {
  const session = await requireSession(HOME_ROUTE);
  const meeting = await insertInstantMeeting(session.user.id);
  return { code: meeting.code, passcode: meeting.passcode };
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

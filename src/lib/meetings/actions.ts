"use server";

import { requireSession } from "@/lib/auth/session";
import { HOME_ROUTE } from "@/lib/routes";

import { insertInstantMeeting } from "./queries";

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

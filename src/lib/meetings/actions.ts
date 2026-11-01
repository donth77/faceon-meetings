"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { HOME_ROUTE } from "@/lib/routes";

import { createInstantMeeting } from "./queries";

/** New meeting → Start an instant meeting: creates it and opens it. */
export async function startInstantMeeting(): Promise<never> {
  const session = await requireSession(HOME_ROUTE);
  const meeting = await createInstantMeeting(session.user.id);
  redirect(`/j/${meeting.code}`);
}

/** New meeting → Create a meeting for later: creates it for sharing. */
export async function createMeetingForLater(): Promise<{
  code: string;
  passcode: string | null;
}> {
  const session = await requireSession(HOME_ROUTE);
  const meeting = await createInstantMeeting(session.user.id);
  return { code: meeting.code, passcode: meeting.passcode };
}

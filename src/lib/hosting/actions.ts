"use server";

import { requireSession } from "@/lib/auth/session";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { HOME_ROUTE } from "@/lib/routes";

import { askForFullMeetings, markApprovalSeen } from "./requests";
import { RequestNote } from "./rules";

export type AskResult =
  "sent" | "full" | "pending" | "declined" | "tooManyTries" | "invalid";

/** Home → Ask for full meetings, with an optional note for the admins. */
export async function askForFullMeetingsAction(
  note: unknown,
): Promise<AskResult> {
  const session = await requireSession(HOME_ROUTE);
  const parsed = RequestNote.optional().safeParse(note ?? undefined);
  if (!parsed.success) return "invalid";
  const limit = [{ key: `hosting-ask:${session.user.id}`, max: 5 }];
  if (await isLimited(limit)) return "tooManyTries";
  await recordAttempt(limit);
  return askForFullMeetings(session.user, parsed.data || null);
}

/** Home: they've seen that an admin approved them. */
export async function dismissApprovalAction(): Promise<void> {
  const session = await requireSession(HOME_ROUTE);
  await markApprovalSeen(session.user.id);
}

"use server";

import { requireSession } from "@/lib/auth/session";
import { serverEnv } from "@/lib/server-env";

import { EmailRemindersChoice } from "./rules";
import { saveEmailReminders } from "./store";
import { readUnsubscribeToken } from "./token";

const NOTIFICATIONS_ROUTE = "/settings/notifications";

/**
 * Settings → Notifications: email reminders on (how long before, and the time zone the
 * emails use, which is the person's own) or off (0). Only to a verified address.
 */
export async function setEmailRemindersAction(
  choice: unknown,
): Promise<boolean> {
  const session = await requireSession(NOTIFICATIONS_ROUTE);
  const parsed = EmailRemindersChoice.safeParse(choice);
  if (!parsed.success || !session.user.emailVerified) return false;
  const { minutes, timeZone } = parsed.data;
  await saveEmailReminders(
    session.user.id,
    minutes === 0 ? null : { minutes, timeZone },
  );
  return true;
}

/** The unsubscribe page's button: turns reminder emails off for the link's account. */
export async function stopEmailRemindersAction(
  token: unknown,
): Promise<boolean> {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  const userId = secret ? readUnsubscribeToken(token, secret) : null;
  if (!userId) return false;
  await saveEmailReminders(userId, null);
  return true;
}

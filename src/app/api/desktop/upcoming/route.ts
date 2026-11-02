import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { getSession } from "@/lib/auth/session";
import { upcomingFor } from "@/lib/meetings/scheduling";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { meetingPath } from "@/lib/routes";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIVATE = { "cache-control": "private, no-store" };

/**
 * The desktop app's reminders (desktop/src/main/reminders.ts): the signed-in person's
 * meetings in the next 24 hours, hosted or invited to, with what Join needs. The app
 * asks with its window's own session about every ten minutes.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { meetings: [] },
      { status: 401, headers: PRIVATE },
    );
  }
  const limit = [{ key: `desktop-upcoming:${session.user.id}`, max: 60 }];
  if (await isLimited(limit)) {
    return NextResponse.json(
      { meetings: [] },
      { status: 429, headers: PRIVATE },
    );
  }
  await recordAttempt(limit);
  const now = new Date();
  const items = await upcomingFor({
    userId: session.user.id,
    verifiedEmail: session.user.emailVerified ? session.user.email : null,
    from: now,
    to: new Date(now.getTime() + DAY_MS),
  });
  const t = await getTranslations({
    locale: routing.defaultLocale,
    namespace: "Reminders",
  });
  return NextResponse.json(
    {
      meetings: items.slice(0, 200).map((item) => ({
        id: `${item.code}:${item.originalStart.toISOString()}`,
        title: item.title ?? t("untitled", { name: item.hostName }),
        startsAt: item.start.toISOString(),
        path: meetingPath(item.code, item.passcode),
      })),
    },
    { headers: PRIVATE },
  );
}

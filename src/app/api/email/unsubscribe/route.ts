import { saveEmailReminders } from "@/lib/reminders/store";
import { readUnsubscribeToken } from "@/lib/reminders/token";
import { serverEnv } from "@/lib/server-env";

const accountFor = (request: Request) => {
  const secret = serverEnv().BETTER_AUTH_SECRET;
  const token = new URL(request.url).searchParams.get("token");
  return secret ? readUnsubscribeToken(token, secret) : null;
};

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here from a reminder email's
 * List-Unsubscribe header, and reminder emails are off.
 */
export async function POST(request: Request) {
  const userId = accountFor(request);
  if (!userId) return new Response("Not found", { status: 404 });
  await saveEmailReminders(userId, null);
  return new Response("Reminder emails are off.", { status: 200 });
}

/** Someone opening the address: the page that asks first, since a GET changes nothing. */
export function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  return Response.redirect(
    new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, url),
    303,
  );
}

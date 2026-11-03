import { auth } from "@/lib/auth/server";
import {
  calendarConnection,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar/connection";
import { loggable } from "@/lib/log";
import { isSameOrigin } from "@/lib/same-origin";

/**
 * GET /api/integrations/google-calendar: where the caller's Google Calendar stands. The
 * desktop app asks while someone connects it in their browser.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  const connection = await calendarConnection(session.user);
  return Response.json(
    { connection },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * DELETE /api/integrations/google-calendar: disconnect Google Calendar. Revokes
 * FaceOn's access with Google, forgets the tokens and stops syncing the caller's
 * meetings; events already in the calendar stay. Connecting goes through Better Auth
 * (linkSocial with the calendar scope).
 */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  try {
    await disconnectGoogleCalendar(session.user.id);
  } catch (error) {
    console.error("Could not disconnect Google Calendar.", loggable(error));
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204 });
}

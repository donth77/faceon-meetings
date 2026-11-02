import { handleMeetingRequest } from "@/lib/meetings/http";
import { markSeen } from "@/lib/meetings/join";
import { getPrincipal } from "@/lib/meetings/principal";

/**
 * POST /api/meetings/{code}/seen: someone in the meeting is leaving, so its session was
 * in use until now (see meetingSession.lastSeenAt).
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/seen">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await markSeen({ code, principal: await getPrincipal(request) });
    return new Response(null, { status: 204 });
  });
}

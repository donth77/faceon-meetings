import { handleMeetingRequest } from "@/lib/meetings/http";
import { endMeetingForAll } from "@/lib/meetings/join";
import { getPrincipal } from "@/lib/meetings/principal";

/** POST /api/meetings/{code}/end: the host ends the meeting for everyone. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/end">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await endMeetingForAll({ code, principal: await getPrincipal(request) });
    return new Response(null, { status: 204 });
  });
}

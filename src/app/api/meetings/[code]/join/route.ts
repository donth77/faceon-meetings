import { JoinRequest } from "@/lib/meetings/api";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { joinMeeting } from "@/lib/meetings/join";
import { getPrincipal } from "@/lib/meetings/principal";

/**
 * POST /api/meetings/{code}/join: admits the caller (200 with a media token), or says to
 * wait for the host (202). The passcode comes in the body, never in a URL.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/join">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    const { name, passcode } = await readJson(request, JoinRequest);
    const result = await joinMeeting({
      code,
      name,
      passcode,
      principal: await getPrincipal(request),
    });
    return Response.json(result, {
      status: result.state === "admitted" ? 200 : 202,
    });
  });
}

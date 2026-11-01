import { TokenRequest, type TokenResponse } from "@/lib/meetings/api";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { refreshMeetingToken } from "@/lib/meetings/join";
import { getPrincipal } from "@/lib/meetings/principal";

/** POST /api/meetings/{code}/token: a fresh media token for someone still in the session. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/token">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    const { room } = await readJson(request, TokenRequest);
    const token = await refreshMeetingToken({
      code,
      room,
      principal: await getPrincipal(request),
    });
    return Response.json({ token } satisfies TokenResponse);
  });
}

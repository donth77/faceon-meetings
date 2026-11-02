import { LobbyAction, type LobbyResponse } from "@/lib/meetings/api";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { getPrincipal } from "@/lib/meetings/principal";
import { decide, lobby } from "@/lib/meetings/waiting-room";

/** GET /api/meetings/{code}/lobby: who's in the waiting room (hosts and co-hosts). */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/lobby">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    const body: LobbyResponse = {
      requests: await lobby({ code, principal: await getPrincipal(request) }),
    };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  });
}

/** POST /api/meetings/{code}/lobby: admit or deny people, or admit everyone. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/lobby">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await decide({
      code,
      principal: await getPrincipal(request),
      action: await readJson(request, LobbyAction),
    });
    return new Response(null, { status: 204 });
  });
}

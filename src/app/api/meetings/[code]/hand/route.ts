import { HandRequest } from "@/lib/meetings/api";
import { updateHand } from "@/lib/meetings/hands";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { getPrincipal } from "@/lib/meetings/principal";

/** POST /api/meetings/{code}/hand: raise or lower a hand (or, for hosts, everyone's). */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/hand">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await updateHand({
      code,
      principal: await getPrincipal(request),
      request: await readJson(request, HandRequest),
    });
    return new Response(null, { status: 204 });
  });
}

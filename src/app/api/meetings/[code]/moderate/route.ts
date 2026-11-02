import { ModerateRequest } from "@/lib/meetings/api";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { moderate } from "@/lib/meetings/moderation";
import { getPrincipal } from "@/lib/meetings/principal";

/** POST /api/meetings/{code}/moderate: host controls (hosts and co-hosts only). */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/moderate">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await moderate({
      code,
      principal: await getPrincipal(request),
      request: await readJson(request, ModerateRequest),
    });
    return new Response(null, { status: 204 });
  });
}

import { handleMeetingRequest } from "@/lib/meetings/http";
import { getPrincipal } from "@/lib/meetings/principal";
import { cancelAdmission, pollAdmission } from "@/lib/meetings/waiting-room";

/**
 * POST /api/meetings/{code}/admission/{requestId}: the waiting room's poll. Returns
 * waiting, denied or expired, or admits the caller once a host let them in.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/admission/[requestId]">,
) {
  return handleMeetingRequest(request, async () => {
    const { code, requestId } = await params;
    const result = await pollAdmission({
      code,
      requestId,
      principal: await getPrincipal(request),
    });
    return Response.json(result);
  });
}

/** DELETE /api/meetings/{code}/admission/{requestId}: stop asking to join. */
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/admission/[requestId]">,
) {
  return handleMeetingRequest(request, async () => {
    const { code, requestId } = await params;
    await cancelAdmission({
      code,
      requestId,
      principal: await getPrincipal(request),
    });
    return new Response(null, { status: 204 });
  });
}

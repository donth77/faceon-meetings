import { ConferenceUpdate } from "@/lib/addon/google/api";
import { handleAddonRequest, readAddonJson } from "@/lib/addon/google/http";
import { cancelConference, updateConference } from "@/lib/addon/google/service";

type Context = RouteContext<"/api/addon/google/conferences/[code]">;

/** PATCH: the event's title, time or repeat changed, or one meeting of its series did. */
export async function PATCH(request: Request, { params }: Context) {
  return handleAddonRequest(request, async (host) => {
    const { code } = await params;
    await updateConference(
      host,
      code,
      await readAddonJson(request, ConferenceUpdate),
    );
    return new Response(null, { status: 204 });
  });
}

/** DELETE: the event was deleted, so the meeting is cancelled. */
export async function DELETE(request: Request, { params }: Context) {
  return handleAddonRequest(request, async (host) => {
    const { code } = await params;
    await cancelConference(host, code);
    return new Response(null, { status: 204 });
  });
}

import { MeetingCreate } from "@/lib/addon/google/api";
import { handleAddonRequest, readAddonJson } from "@/lib/addon/google/http";
import { addonMeeting } from "@/lib/addon/google/service";

/** POST /api/addon/google/meetings: a new meeting, or the personal room, with its invitation. */
export async function POST(request: Request) {
  return handleAddonRequest(request, async (host) =>
    Response.json(
      await addonMeeting(host, await readAddonJson(request, MeetingCreate)),
    ),
  );
}

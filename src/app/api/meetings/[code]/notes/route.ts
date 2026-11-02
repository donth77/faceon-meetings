import { NotesRequest, NotesSettingsRequest } from "@/lib/meetings/api";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { setNotes, setNotesSettings } from "@/lib/meetings/notes";
import { getPrincipal } from "@/lib/meetings/principal";

/** POST /api/meetings/{code}/notes: a host or co-host turns AI notes on or off. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/notes">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await setNotes({
      code,
      principal: await getPrincipal(request),
      request: await readJson(request, NotesRequest),
    });
    return new Response(null, { status: 204 });
  });
}

/**
 * PATCH /api/meetings/{code}/notes: the meeting's host sets whether AI notes start
 * automatically in this meeting, and whether they're shared with its participants.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/notes">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    await setNotesSettings({
      code,
      principal: await getPrincipal(request),
      request: await readJson(request, NotesSettingsRequest),
    });
    return new Response(null, { status: 204 });
  });
}

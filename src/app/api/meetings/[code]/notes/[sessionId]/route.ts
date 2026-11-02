import { SaveNotesRequest, ShareNotesRequest } from "@/lib/meetings/api";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { getPrincipal } from "@/lib/meetings/principal";
import { deleteNotes, saveNotes, shareNotes } from "@/lib/meetings/saved-notes";

type Context = RouteContext<"/api/meetings/[code]/notes/[sessionId]">;

/**
 * PUT /api/meetings/{code}/notes/{sessionId}: save AI notes to that session, replacing
 * any saved before. Hosts and co-hosts with an account, also after the meeting.
 */
export async function PUT(request: Request, { params }: Context) {
  return handleMeetingRequest(request, async () => {
    const { code, sessionId } = await params;
    await saveNotes({
      code,
      sessionId,
      principal: await getPrincipal(request),
      request: await readJson(request, SaveNotesRequest),
    });
    return new Response(null, { status: 204 });
  });
}

/** PATCH /api/meetings/{code}/notes/{sessionId}: share saved notes with attendees, or stop. */
export async function PATCH(request: Request, { params }: Context) {
  return handleMeetingRequest(request, async () => {
    const { code, sessionId } = await params;
    const { shared } = await readJson(request, ShareNotesRequest);
    await shareNotes({
      code,
      sessionId,
      principal: await getPrincipal(request),
      shared,
    });
    return new Response(null, { status: 204 });
  });
}

/** DELETE /api/meetings/{code}/notes/{sessionId}: delete saved notes. */
export async function DELETE(request: Request, { params }: Context) {
  return handleMeetingRequest(request, async () => {
    const { code, sessionId } = await params;
    await deleteNotes({
      code,
      sessionId,
      principal: await getPrincipal(request),
    });
    return new Response(null, { status: 204 });
  });
}

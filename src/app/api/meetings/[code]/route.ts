import { meetingPageAttempts } from "@/lib/meetings/attempts";
import { handleMeetingRequest } from "@/lib/meetings/http";
import type { MeetingLookup } from "@/lib/meetings/lookup";
import { meetingAvailability } from "@/lib/meetings/queries";
import { isLimited, recordDistinctAttempt } from "@/lib/rate-limit";

/**
 * GET /api/meetings/{code}: whether a meeting ID leads to a meeting, so the Join field
 * can say "there's no meeting with that ID" without leaving the page. It tells no more
 * than the meeting's page would, and an unknown ID counts against the caller exactly as
 * opening its page does (the same budget, each ID once), so it's no faster for guessing.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    const attempts = meetingPageAttempts(request, code);
    const answer = (meeting: MeetingLookup["meeting"]) =>
      Response.json({ meeting } satisfies MeetingLookup, {
        headers: { "Cache-Control": "no-store" },
      });
    if (await isLimited(attempts.limits)) return answer("tooManyTries");
    const availability = await meetingAvailability(code);
    if (availability === null) {
      await recordDistinctAttempt(attempts.limits, attempts.seen);
      return answer("notFound");
    }
    return answer(availability);
  });
}

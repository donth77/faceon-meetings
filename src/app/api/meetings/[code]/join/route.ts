import { guestsEnabled, newGuest, saveGuest } from "@/lib/guest-session";
import { JoinRequest } from "@/lib/meetings/api";
import { FAILED_JOIN, joinAttemptLimits } from "@/lib/meetings/attempts";
import { MeetingError } from "@/lib/meetings/errors";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { joinMeeting } from "@/lib/meetings/join";
import { getPrincipal, guestPrincipal } from "@/lib/meetings/principal";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

/**
 * POST /api/meetings/{code}/join: admits the caller (200 with a media token), or says to
 * wait for the host (202). The passcode comes in the body, never in a URL. Someone
 * without an account joins as a guest; this browser keeps its guest ID in a cookie.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/join">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    const { name, passcode } = await readJson(request, JoinRequest);
    const limits = joinAttemptLimits(request, code);
    if (await isLimited(limits)) throw new MeetingError("RATE_LIMITED");

    const principal =
      (await getPrincipal(request)) ??
      (guestsEnabled() ? guestPrincipal(newGuest(name)) : null);
    let result;
    try {
      result = await joinMeeting({ code, name, passcode, principal });
    } catch (error) {
      if (error instanceof MeetingError && FAILED_JOIN.has(error.code)) {
        await recordAttempt(limits);
      }
      throw error;
    }
    // Keep (and renew) the guest ID, so a refresh or rejoin is the same person.
    if (principal?.kind === "guest") await saveGuest(principal.guest);
    return Response.json(result, {
      status: result.state === "admitted" ? 200 : 202,
    });
  });
}

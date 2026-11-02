import { guestForJoin, guestsEnabled, saveGuest } from "@/lib/guest-session";
import { humanCheckOn, passedHumanCheck } from "@/lib/human-check/verify";
import { JoinRequest } from "@/lib/meetings/api";
import {
  FAILED_JOIN,
  joinAttemptLimits,
  waitingRoomLimits,
} from "@/lib/meetings/attempts";
import { MeetingError } from "@/lib/meetings/errors";
import { handleMeetingRequest, readJson } from "@/lib/meetings/http";
import { joinMeeting } from "@/lib/meetings/join";
import { getPrincipal, guestPrincipal } from "@/lib/meetings/principal";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

/**
 * POST /api/meetings/{code}/join: admits the caller (200 with a media token), or says to
 * wait for the host (202). The passcode comes in the body, never in a URL. Someone
 * without an account joins as a guest, with the avatar the join screen showed; this
 * browser keeps its guest ID and that avatar in a cookie. Where this copy checks for a
 * person (Turnstile), a browser's first guest join carries the check's token; once it
 * passes, the guest ID is kept at once, so a retry (a corrected passcode, say) and later
 * joins from this browser skip it.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/meetings/[code]/join">,
) {
  return handleMeetingRequest(request, async () => {
    const { code } = await params;
    const { name, passcode, avatarSeed, humanCheck } = await readJson(
      request,
      JoinRequest,
    );
    const limits = joinAttemptLimits(request, code);
    const lobbyLimits = waitingRoomLimits(request);
    const [limited, lobbyFull] = await Promise.all([
      isLimited(limits),
      isLimited(lobbyLimits),
    ]);
    if (limited) throw new MeetingError("RATE_LIMITED");

    const caller = await getPrincipal(request);
    // A browser without a guest ID yet shows there's a person behind it first.
    const firstGuestJoin = !caller && guestsEnabled() && humanCheckOn();
    if (
      firstGuestJoin &&
      !(await passedHumanCheck({
        token: humanCheck,
        action: "guest-join",
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      }))
    ) {
      await recordAttempt(limits);
      throw new MeetingError("HUMAN_CHECK_FAILED");
    }
    const principal =
      caller?.kind === "user"
        ? caller
        : guestsEnabled()
          ? guestPrincipal(
              guestForJoin(caller?.guest ?? null, { name, avatarSeed }),
            )
          : null;
    // Passed: keep the guest ID now, so a retry doesn't ask again.
    if (firstGuestJoin && principal?.kind === "guest") {
      await saveGuest(principal.guest);
    }
    let result;
    try {
      result = await joinMeeting({
        code,
        name,
        passcode,
        principal,
        canAskHosts: !lobbyFull,
      });
    } catch (error) {
      if (error instanceof MeetingError && FAILED_JOIN.has(error.code)) {
        await recordAttempt(limits);
      }
      throw error;
    }
    if (result.state === "waiting") await recordAttempt(lobbyLimits);
    // Keep (and renew) the guest ID, so a refresh or rejoin is the same person.
    if (principal?.kind === "guest") await saveGuest(principal.guest);
    return Response.json(result, {
      status: result.state === "admitted" ? 200 : 202,
    });
  });
}

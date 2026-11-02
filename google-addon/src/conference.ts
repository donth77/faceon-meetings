import { CONFERENCE_SOLUTION_ID, FACEON_URL } from "./config";
import { textFor } from "./i18n";

/** Calendar's conference-creation event (calendar.conferenceSolution.onCreateFunction). */
export type ConferenceCreateEvent = {
  eventData?: { calendarId?: string; eventId?: string };
};

/**
 * The spike: a stub "FaceOn meeting" that proves the conference solution shows up and
 * how Google calls it. It logs the identity token's claims (not the token) to the
 * project's executions, so `aud` and `sub` can be checked against what FaceOn's API
 * expects. An event titled "auth-test" returns the AUTHENTICATION error instead, to try
 * its sign-in link. The real conference (piece 3) replaces this.
 */
export function onCreateConference(
  event: ConferenceCreateEvent,
): GoogleAppsScript.Conference_Data.ConferenceData {
  const builder = ConferenceDataService.newConferenceDataBuilder();
  logIdentityClaims();
  const title = eventTitle(event);
  if (title === "auth-test") {
    return builder
      .setError(
        ConferenceDataService.newConferenceError()
          .setConferenceErrorType(
            ConferenceDataService.ConferenceErrorType.AUTHENTICATION,
          )
          .setAuthenticationUrl(
            `${FACEON_URL}/sign-in?next=/settings/calendar`,
          ),
      )
      .build();
  }
  const id = "spike-0000";
  return builder
    .setConferenceSolutionId(CONFERENCE_SOLUTION_ID)
    .setConferenceId(id)
    .addEntryPoint(
      ConferenceDataService.newEntryPoint()
        .setEntryPointType(ConferenceDataService.EntryPointType.VIDEO)
        .setUri(`${FACEON_URL}/`)
        .setMeetingCode(id),
    )
    .setNotes(textFor(undefined)("conference.spike"))
    .build();
}

function eventTitle(event: ConferenceCreateEvent): string | null {
  const { calendarId, eventId } = event.eventData ?? {};
  if (!calendarId || !eventId) return null;
  try {
    return Calendar?.Events?.get(calendarId, eventId).summary ?? null;
  } catch {
    // A new event isn't saved yet: Calendar knows only its ID.
    return null;
  }
}

/** The identity token's audience and subject, for the spike's checklist. */
function logIdentityClaims(): void {
  const token = ScriptApp.getIdentityToken();
  const payload = token.split(".")[1];
  if (!payload) return;
  const claims = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString(),
  ) as Record<string, unknown>;
  console.log(
    JSON.stringify({
      aud: claims.aud,
      sub: claims.sub,
      iss: claims.iss,
      email_verified: claims.email_verified,
    }),
  );
}

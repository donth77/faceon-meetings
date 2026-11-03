import type { EventTiming } from "../../src/lib/addon/google/types";
import { api } from "./api";
import { CODE_PARAMETER, timingOf } from "./calendar-events";
import { conferencePlan, type ConferencePlan } from "./conference-plan";
import { CONFERENCE_SOLUTION_ID } from "./config";
import { localeOf, textFor } from "./i18n";
import { ensureSyncTrigger, rememberEvent } from "./sync";

/** Calendar's conference-creation event (calendar.conferenceSolution.onCreateFunction). */
export type ConferenceCreateEvent = {
  eventData?: { calendarId?: string; eventId?: string };
};

/**
 * "FaceOn meeting" chosen in Calendar's Add video conferencing: FaceOn makes the meeting
 * (or gives the one it already made for this event) and the event gets its join link,
 * meeting ID and passcode. A new event Google hasn't saved yet gets its time on FaceOn's
 * side when it is: the Calendar trigger set up here sends it.
 */
export function onCreateConference(
  event: ConferenceCreateEvent,
): GoogleAppsScript.Conference_Data.ConferenceData {
  const { calendarId, eventId } = event.eventData ?? {};
  const t = textFor();
  if (!calendarId || !eventId) {
    return build({ kind: "error", type: "TEMPORARY" });
  }
  const timing = savedTiming(calendarId, eventId);
  const result = api.createConference({
    eventId,
    calendarId,
    locale: localeOf(),
    ...(timing ? { event: timing } : {}),
  });
  if (result.ok) {
    rememberEvent(eventId, result.data.code);
    try {
      ensureSyncTrigger(calendarId);
    } catch (error) {
      // Without the trigger, later changes to the event don't reach FaceOn; the meeting works.
      console.error(`Couldn't set up the Calendar trigger: ${String(error)}`);
    }
  }
  return build(conferencePlan(result, t));
}

/** The event as Calendar has it saved; nothing while it's new and unsaved. */
function savedTiming(
  calendarId: string,
  eventId: string,
): EventTiming | undefined {
  try {
    const saved = Calendar?.Events?.get(calendarId, eventId);
    return saved ? timingOf(saved as never) : undefined;
  } catch {
    return undefined;
  }
}

function build(
  plan: ConferencePlan,
): GoogleAppsScript.Conference_Data.ConferenceData {
  const builder = ConferenceDataService.newConferenceDataBuilder();
  if (plan.kind === "error") {
    const error =
      ConferenceDataService.newConferenceError().setConferenceErrorType(
        ConferenceDataService.ConferenceErrorType[plan.type],
      );
    if (plan.authenticationUrl)
      error.setAuthenticationUrl(plan.authenticationUrl);
    return builder.setError(error).build();
  }
  const video = ConferenceDataService.newEntryPoint()
    .setEntryPointType(ConferenceDataService.EntryPointType.VIDEO)
    .setUri(plan.joinUrl)
    .setMeetingCode(plan.meetingId);
  if (plan.passcode) video.setPasscode(plan.passcode);
  return builder
    .setConferenceSolutionId(CONFERENCE_SOLUTION_ID)
    .setConferenceId(plan.code)
    .addEntryPoint(video)
    .addConferenceParameter(
      ConferenceDataService.newConferenceParameter()
        .setKey(CODE_PARAMETER)
        .setValue(plan.code),
    )
    .setNotes(plan.notes)
    .build();
}

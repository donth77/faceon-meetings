import { api } from "./api";
import { errorCard, homeCard, meetingCard, meetingIdFrom } from "./cards";
import { FACEON_URL } from "./config";
import { inputOf, localeOf, textFor, type AddonEvent } from "./i18n";
import { notify, openUrl, pushCard, render, updateCard } from "./render";

/** The sidebar in Calendar and Gmail (addOns.common.homepageTrigger). */
export function onHomepage(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.Card {
  return render(homeModel(event));
}

/** Try again, after FaceOn couldn't be reached. */
export function onReloadHome(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.ActionResponse {
  return updateCard(homeModel(event));
}

function homeModel(event: AddonEvent) {
  const t = textFor(event);
  const result = api.home(
    localeOf(event),
    event.commonEventObject?.timeZone?.id,
  );
  if (result.ok) return homeCard(t, result.data, FACEON_URL);
  return errorCard(t, result.error);
}

/** Start a meeting: a new one, with Join and its invitation. */
export function onStartMeeting(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.ActionResponse {
  const t = textFor(event);
  const result = api.meeting({ kind: "new", locale: localeOf(event) });
  if (result.ok) return pushCard(meetingCard(t, result.data));
  return pushCard(errorCard(t, result.error));
}

/** The personal room's invitation, to select and copy (cards can't copy by themselves). */
export function onShowInvitation(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.ActionResponse {
  const t = textFor(event);
  const result = api.meeting({ kind: "personalRoom", locale: localeOf(event) });
  if (result.ok) return pushCard(meetingCard(t, result.data));
  return pushCard(errorCard(t, result.error));
}

/** Join with a meeting ID: opens the meeting in FaceOn. */
export function onJoinById(
  event: AddonEvent,
): GoogleAppsScript.Card_Service.ActionResponse {
  const code = meetingIdFrom(inputOf(event, "meetingId"));
  if (!code) return notify(textFor(event)("home.badMeetingId"));
  return openUrl(`${FACEON_URL}/j/${code}`);
}

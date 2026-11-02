/**
 * Every function Google calls by name: the manifest's triggers, the cards' actions and
 * the Calendar trigger. The build adds a global function for each (Apps Script only
 * calls globals), which passes the event on to the bundle.
 */
export const HANDLERS = [
  "onHomepage",
  "onReloadHome",
  "onStartMeeting",
  "onJoinById",
  "onShowInvitation",
  "onCreateConference",
  "onCalendarEventUpdated",
  "createSettingsUrl",
  "onCompose",
  "onComposeInsert",
] as const;

export type HandlerName = (typeof HANDLERS)[number];

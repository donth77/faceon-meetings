/**
 * Every function Google calls by name: the manifest's triggers and the cards' actions.
 * The build adds a global function for each (Apps Script only calls globals), which
 * passes the event on to the bundle.
 */
export const HANDLERS = [
  "onHomepage",
  "onCreateConference",
  "createSettingsUrl",
] as const;

export type HandlerName = (typeof HANDLERS)[number];

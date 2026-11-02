/**
 * The add-on's entry: every handler Google calls (handlers.ts lists their names). The
 * build bundles this into one script and adds a global function for each.
 */
export { onCreateConference } from "./conference";
export { onHomepage } from "./home";
export { createSettingsUrl } from "./settings";

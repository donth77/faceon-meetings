/**
 * The add-on's entry: every handler Google calls (handlers.ts lists their names). The
 * build bundles this into one script and adds a global function for each.
 */
export { onCompose, onComposeInsert } from "./compose";
export { onCreateConference } from "./conference";
export {
  onHomepage,
  onJoinById,
  onReloadHome,
  onShowInvitation,
  onStartMeeting,
} from "./home";
export { createSettingsUrl } from "./settings";
export { onCalendarEventUpdated } from "./sync";

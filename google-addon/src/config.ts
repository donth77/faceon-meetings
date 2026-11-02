/** Set by the build (build.mjs): the FaceOn copy this add-on talks to, and its name. */
declare const __FACEON_URL__: string;
declare const __APP_NAME__: string;

/** The FaceOn copy's origin, without a trailing slash: https://joinfaceon.app. */
export const FACEON_URL = __FACEON_URL__;
export const APP_NAME = __APP_NAME__;

/** The conference solution's ID in the manifest (calendar.conferenceSolution). */
export const CONFERENCE_SOLUTION_ID = "faceon";

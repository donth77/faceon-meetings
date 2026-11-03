import type { AddonConfig } from "../../src/lib/addon/google/types";

/**
 * This copy's settings: Code.js's first line, ahead of the bundle. FaceOn writes it into
 * each person's own copy (src/lib/addon/google/content.ts), and build.mjs a developer's.
 */
declare const FACEON_CONFIG: AddonConfig;

/** The FaceOn copy's origin, without a trailing slash: https://joinfaceon.app. */
export const FACEON_URL = FACEON_CONFIG.url;
export const APP_NAME = FACEON_CONFIG.name;
/** Which build this is; FaceOn updates a copy that's behind. */
export const ADDON_VERSION = FACEON_CONFIG.version;
/** Connects this copy to its owner's FaceOn account when it's first used. */
export const CONNECT_TOKEN = FACEON_CONFIG.connectToken;

/** The conference solution's ID in the manifest (calendar.conferenceSolution). */
export const CONFERENCE_SOLUTION_ID = "faceon";

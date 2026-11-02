/**
 * What /desktop/sign-in accepts from the desktop app's link (lib/desktop/handoff.ts):
 * shared by the page, the browser and the server.
 */
export const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
export const STATE = /^[A-Za-z0-9_-]{16,128}$/;
export const PROVIDERS = ["google", "github"] as const;
export type HandoffProvider = (typeof PROVIDERS)[number];

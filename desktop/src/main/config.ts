/** Fixed when the app is built (scripts/build.mjs); see desktop/README.md. */
declare const __APP_URL__: string;
declare const __APP_NAME__: string;
declare const __RELEASES_REPO__: string;
declare const __DEV__: boolean;

export const IS_DEV = __DEV__;

/** The hosted app this build opens. In development, FACEON_APP_URL can point elsewhere. */
export const APP_URL = new URL(
  (IS_DEV && process.env.FACEON_APP_URL) || __APP_URL__,
);
export const APP_ORIGIN = APP_URL.origin;
export const APP_NAME = __APP_NAME__;

/** "owner/name" of the releases repository, or "" where this build has none. */
export const RELEASES_REPO = __RELEASES_REPO__;

export const PROTOCOL = "faceon";
/** The app's own cookies and storage, kept between runs. */
export const PARTITION = "persist:faceon";

/** Tests run the app with every window hidden. */
export const HIDDEN = process.env.FACEON_HIDDEN === "1";

/** A path on the app's origin, as a full URL. */
export const appUrl = (path: string) => new URL(path, APP_ORIGIN).toString();

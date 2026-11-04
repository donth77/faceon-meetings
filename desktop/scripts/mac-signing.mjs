// What the Mac build signs and notarizes with, read from the environment (scripts/mac.mjs).
// Kept apart from mac.mjs, which only runs on a Mac, so it can be tested anywhere.

/**
 * Where the Developer ID certificate comes from: a .p12 in CSC_LINK with its password
 * (as on GitHub, where electron-builder imports it into a keychain of its own), or the
 * "Developer ID Application" identity found in this Mac's login keychain. Null: unsigned.
 * @param {NodeJS.ProcessEnv} env
 * @param {string | null} keychainIdentity
 */
export function signingSource(env, keychainIdentity) {
  if (env.CSC_LINK?.trim() && env.CSC_KEY_PASSWORD) {
    return "the Developer ID certificate in CSC_LINK";
  }
  return keychainIdentity;
}

/**
 * How notarytool signs in, from the same settings electron-builder notarizes the app
 * with: a keychain profile, an App Store Connect API key, or an Apple ID. The label says
 * which, without any secret; null when none is set.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ label: string; args: string[] } | null}
 */
export function notaryCredentials(env) {
  if (env.APPLE_KEYCHAIN_PROFILE) {
    return {
      label: `keychain profile "${env.APPLE_KEYCHAIN_PROFILE}"`,
      args: ["--keychain-profile", env.APPLE_KEYCHAIN_PROFILE],
    };
  }
  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) {
    return {
      label: `App Store Connect key ${env.APPLE_API_KEY_ID}`,
      args: [
        "--key",
        env.APPLE_API_KEY,
        "--key-id",
        env.APPLE_API_KEY_ID,
        "--issuer",
        env.APPLE_API_ISSUER,
      ],
    };
  }
  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) {
    return {
      label: `Apple ID ${env.APPLE_ID}`,
      args: [
        "--apple-id",
        env.APPLE_ID,
        "--password",
        env.APPLE_APP_SPECIFIC_PASSWORD,
        "--team-id",
        env.APPLE_TEAM_ID,
      ],
    };
  }
  return null;
}

/**
 * The files a Mac release carries, among those the build left in desktop/release: the
 * disk image people download, and the zip with its block map and latest-mac.yml that
 * installed apps update from.
 * @param {string[]} names
 */
export function macReleaseFiles(names) {
  return names
    .filter(
      (name) =>
        name.endsWith(".dmg") ||
        name.endsWith("-mac.zip") ||
        name.endsWith("-mac.zip.blockmap") ||
        name === "latest-mac.yml",
    )
    .sort();
}

/**
 * Whether Gatekeeper's verdict (spctl's output) accepts the file as notarized Developer ID
 * software: what a Mac checks the first time someone opens it.
 * @param {string} output
 */
export function acceptedAsNotarized(output) {
  return (
    /: accepted\b/.test(output) && /source=Notarized Developer ID/.test(output)
  );
}

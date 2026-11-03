// Signing the Windows app with Azure Artifact Signing ("Signing on Windows" in
// desktop/RELEASING.md). electron-builder.config.cjs and scripts/windows.mjs share these.

/** The settings signing needs: the account's endpoint, its name and the certificate profile's. */
export const SIGNING_SETTINGS = [
  "ARTIFACT_SIGNING_ENDPOINT",
  "ARTIFACT_SIGNING_ACCOUNT",
  "ARTIFACT_SIGNING_PROFILE",
];

/**
 * @typedef {object} AzureSignOptions electron-builder's `win.azureSignOptions`.
 * @property {string} endpoint
 * @property {string} codeSigningAccountName
 * @property {string} certificateProfileName
 * @property {string} [publisherName] The certificate's name: installed apps accept only
 *   updates signed with it.
 */

/**
 * How to sign, or null (an unsigned build) until all three settings are set. electron-builder
 * hands these to Microsoft's TrustedSigning module, which signs as whoever ran `az login`.
 * @param {Record<string, string | undefined>} env
 * @returns {AzureSignOptions | null}
 */
export function azureSignOptions(env) {
  const [endpoint, account, profile] = SIGNING_SETTINGS.map((name) =>
    env[name]?.trim(),
  );
  if (!endpoint || !account || !profile) return null;
  const publisher = env.WINDOWS_PUBLISHER_NAME?.trim();
  return {
    endpoint,
    codeSigningAccountName: account,
    certificateProfileName: profile,
    ...(publisher ? { publisherName: publisher } : {}),
  };
}

/**
 * Why `pnpm desktop:win --publish` mustn't go ahead, or null when it may. Smart App
 * Control, on many new Windows 11 PCs, blocks unsigned apps with no way past it.
 * @param {{ signed: boolean; allowUnsigned: boolean; token: string | undefined }} build
 * @returns {string | null}
 */
export function publishRefusal({ signed, allowUnsigned, token }) {
  if (!signed && !allowUnsigned) {
    return (
      "Refusing to publish a Windows build that isn't signed: PCs with Smart App Control\n" +
      "on wouldn't open it at all, and SmartScreen warns on the rest. (--allow-unsigned overrides.)"
    );
  }
  if (!token) return "Publishing needs GH_TOKEN (see desktop/RELEASING.md).";
  return null;
}

/**
 * The name (CN) in a certificate's subject, such as "CN=Jane Doe, O=Jane Doe, C=US", which
 * is what WINDOWS_PUBLISHER_NAME holds.
 * @param {string} subject
 * @returns {string | null}
 */
export function certificateName(subject) {
  const match = /(?:^|,\s*)CN=(?:"((?:[^"]|"")*)"|([^,]*))/.exec(subject);
  if (!match) return null;
  return (match[1]?.replaceAll('""', '"') ?? match[2] ?? "").trim() || null;
}

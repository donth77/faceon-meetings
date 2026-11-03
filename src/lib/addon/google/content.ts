/**
 * The add-on's files for one copy: the manifest (appsscript.json) filled in for this
 * FaceOn, and Code.js, whose first line is the copy's own settings (AddonConfig) ahead of
 * the bundle every copy shares. FaceOn writes them into people's Apps Script projects
 * (setup.ts), and build.mjs into a developer's dist/. Plain functions with type-only
 * imports, so build.mjs can load this file with Node as it is.
 */
import type { AddonConfig } from "./types";

/** What one FaceOn copy shows in Google: its address, its name and its logos. */
export type AddonCopy = {
  /** The origin, without a trailing slash. */
  url: string;
  name: string;
  /** The side panel's icon. */
  logoUrl: string;
  /** Beside a meeting in Calendar: Google shows it only from its own servers. */
  conferenceLogoUrl: string;
};

/** The add-on as the build makes it, the same for every copy (bundle.generated.json). */
export type AddonBundle = { version: string; code: string; manifest: string };

/** One file of an Apps Script project, as the Apps Script API takes it. */
export type ScriptFile = {
  name: string;
  type: "SERVER_JS" | "JSON";
  source: string;
};

/** A developer's own build: FaceOn leaves it as it is rather than update it. */
export const DEV_VERSION = "dev";

/**
 * FaceOn's logo where Google hosts it, for Calendar to show beside a FaceOn meeting
 * (Google's manifest docs: a conference logo "must be hosted on Google infrastructure").
 * Null until there is one; a copy with another name sets its own.
 */
export const FACEON_CONFERENCE_LOGO_URL: string | null = null;

/** A copy's conference logo: the one it set, FaceOn's for FaceOn, or else its icon. */
export function conferenceLogo(copy: {
  name: string;
  own?: string;
  icon: string;
}): string {
  if (copy.own) return copy.own;
  if (copy.name === "FaceOn" && FACEON_CONFERENCE_LOGO_URL) {
    return FACEON_CONFERENCE_LOGO_URL;
  }
  return copy.icon;
}

/** A value inside one of the manifest's JSON strings. */
const inJsonString = (value: string) => JSON.stringify(value).slice(1, -1);

/** The manifest template (google-addon/appsscript.json) filled in for a copy. */
export function fillManifest(template: string, copy: AddonCopy): string {
  const values: Record<string, string> = {
    FACEON_URL: copy.url,
    APP_NAME: copy.name,
    LOGO_URL: copy.logoUrl,
    CONFERENCE_LOGO_URL: copy.conferenceLogoUrl,
  };
  const filled = template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? inJsonString(values[key] ?? "") : whole,
  );
  JSON.parse(filled); // a broken template fails here, not in Google
  return filled;
}

/** Code.js: the copy's settings, then the bundle that reads them. */
export function codeWith(config: AddonConfig, code: string): string {
  return `var FACEON_CONFIG = ${JSON.stringify(config)};\n${code}`;
}

/** Every file of a copy's Apps Script project. */
export function addonFiles(
  bundle: AddonBundle,
  copy: AddonCopy,
  config: AddonConfig,
): ScriptFile[] {
  return [
    {
      name: "appsscript",
      type: "JSON",
      source: fillManifest(bundle.manifest, copy),
    },
    { name: "Code", type: "SERVER_JS", source: codeWith(config, bundle.code) },
  ];
}

/**
 * Builds the add-on for Apps Script: dist/Code.js (one script, every handler a global
 * function) and dist/appsscript.json (the manifest, filled in for this FaceOn copy).
 * Run it with `pnpm addon:build`; `pnpm addon:push` builds and pushes with clasp.
 *
 * Settings (environment variables):
 *   FACEON_URL                  the FaceOn copy the add-on talks to (https://joinfaceon.app)
 *   NEXT_PUBLIC_APP_NAME        its name (FaceOn)
 *   FACEON_ADDON_LOGO_URL       the sidebar's icon (the copy's 192 px icon)
 *   FACEON_CONFERENCE_LOGO_URL  the conference solution's logo; Google asks for one it hosts
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

import { HANDLERS } from "./src/handlers.ts";

const here = new URL(".", import.meta.url);
const siteUrl = (process.env.FACEON_URL || "https://joinfaceon.app").replace(
  /\/$/,
  "",
);
const appName = process.env.NEXT_PUBLIC_APP_NAME || "FaceOn";
const logoUrl =
  process.env.FACEON_ADDON_LOGO_URL || `${siteUrl}/icons/icon-192.png`;
const conferenceLogoUrl = process.env.FACEON_CONFERENCE_LOGO_URL || logoUrl;

// Card text: every language's GoogleAddon messages.
const messages = new URL("../messages/", here);
const texts = {};
for (const file of (await readdir(messages)).sort()) {
  if (!file.endsWith(".json")) continue;
  const all = JSON.parse(await readFile(new URL(file, messages), "utf8"));
  if (all.GoogleAddon) texts[file.slice(0, -".json".length)] = all.GoogleAddon;
}
if (!texts.en) throw new Error("messages/en.json has no GoogleAddon section.");

const result = await build({
  entryPoints: [fileURLToPath(new URL("src/main.ts", here))],
  bundle: true,
  format: "iife",
  globalName: "FaceOnAddon",
  platform: "neutral",
  target: "es2019",
  charset: "utf8",
  legalComments: "none",
  write: false,
  define: {
    __FACEON_URL__: JSON.stringify(siteUrl),
    __APP_NAME__: JSON.stringify(appName),
    __TEXTS__: JSON.stringify(texts),
  },
});

// Apps Script calls only global functions: one for each handler, into the bundle.
const globals = HANDLERS.map(
  (name) =>
    `function ${name}(event) {\n  return FaceOnAddon.${name}(event);\n}`,
).join("\n\n");
const code = `${result.outputFiles[0].text}\n${globals}\n`;

const manifest = (await readFile(new URL("appsscript.json", here), "utf8"))
  .replaceAll("{{FACEON_URL}}", siteUrl)
  .replaceAll("{{APP_NAME}}", appName)
  .replaceAll("{{LOGO_URL}}", logoUrl)
  .replaceAll("{{CONFERENCE_LOGO_URL}}", conferenceLogoUrl);
JSON.parse(manifest); // a broken template fails here, not in Google

const dist = new URL("dist/", here);
await mkdir(dist, { recursive: true });
await writeFile(new URL("Code.js", dist), code);
await writeFile(new URL("appsscript.json", dist), manifest);
console.log(
  `Built the add-on for ${siteUrl}: dist/Code.js and dist/appsscript.json`,
);

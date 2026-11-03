/**
 * Builds the add-on for Apps Script: one script with every handler a global function,
 * and the manifest. The script reads its copy's settings (FaceOn's address and name, its
 * version, and the token that connects it) from Code.js's first line.
 *
 *   node build.mjs --bundle   the add-on FaceOn puts in people's Google accounts:
 *                             src/lib/addon/google/bundle.generated.json, the same for every
 *                             copy, with a version FaceOn keeps them up to date with. dev,
 *                             build, test and typecheck make it first.
 *   node build.mjs            dist/Code.js and dist/appsscript.json, a developer's own build
 *                             (`pnpm addon:build`; `pnpm addon:push` pushes it with clasp).
 *
 * A developer's build reads FACEON_URL (https://joinfaceon.app by default),
 * NEXT_PUBLIC_APP_NAME (FaceOn), GOOGLE_ADDON_CONFERENCE_LOGO_URL and FACEON_CONNECT_TOKEN,
 * and is version "dev", which FaceOn never replaces.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

import {
  addonFiles,
  conferenceLogo,
  DEV_VERSION,
} from "../src/lib/addon/google/content.ts";
import { HANDLERS } from "./src/handlers.ts";

const here = new URL(".", import.meta.url);

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
  define: { __TEXTS__: JSON.stringify(texts) },
});

// Apps Script calls only global functions: one for each handler, into the bundle.
const globals = HANDLERS.map(
  (name) =>
    `function ${name}(event) {\n  return FaceOnAddon.${name}(event);\n}`,
).join("\n\n");
const code = `${result.outputFiles[0].text}\n${globals}\n`;
const manifest = await readFile(new URL("appsscript.json", here), "utf8");

if (process.argv.includes("--bundle")) {
  const version = createHash("sha256")
    .update(`${code}\n${manifest}`)
    .digest("hex")
    .slice(0, 12);
  const out = new URL("../src/lib/addon/google/bundle.generated.json", here);
  await writeFile(
    out,
    `${JSON.stringify({ version, code, manifest }, null, 2)}\n`,
  );
  console.log(`Bundled the add-on, version ${version}.`);
} else {
  const url = (process.env.FACEON_URL || "https://joinfaceon.app").replace(
    /\/$/,
    "",
  );
  const name = process.env.NEXT_PUBLIC_APP_NAME || "FaceOn";
  const icon = `${url}/icons/icon-192.png`;
  const files = addonFiles(
    { version: DEV_VERSION, code, manifest },
    {
      url,
      name,
      logoUrl: icon,
      conferenceLogoUrl: conferenceLogo({
        name,
        own: process.env.GOOGLE_ADDON_CONFERENCE_LOGO_URL,
        icon,
      }),
    },
    {
      url,
      name,
      version: DEV_VERSION,
      connectToken: process.env.FACEON_CONNECT_TOKEN ?? "",
    },
  );
  const dist = new URL("dist/", here);
  await mkdir(dist, { recursive: true });
  for (const file of files) {
    const extension = file.type === "JSON" ? "json" : "js";
    await writeFile(new URL(`${file.name}.${extension}`, dist), file.source);
  }
  console.log(
    `Built the add-on for ${url}: dist/Code.js and dist/appsscript.json`,
  );
}

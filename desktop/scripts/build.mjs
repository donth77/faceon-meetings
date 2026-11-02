// Bundles the app's main process, preloads and share picker into dist/.
// --dev: a development build, which opens http://localhost:3000 unless FACEON_APP_URL
// says otherwise, and lets FACEON_APP_URL change it when the app starts.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

import { desktopDir, loadDesktopEnv, RELEASES_REPO_PATTERN } from "./env.mjs";

loadDesktopEnv();
const dev = process.argv.includes("--dev");
const appUrl =
  process.env.FACEON_APP_URL ||
  (dev ? "http://localhost:3000" : "https://joinfaceon.app");
const name = process.env.NEXT_PUBLIC_APP_NAME || "FaceOn";
const releases = process.env.DESKTOP_RELEASES_REPO || "";

const url = new URL(appUrl);
if (url.protocol !== "https:" && !(dev && url.hostname === "localhost")) {
  throw new Error(`FACEON_APP_URL must be https:// (got ${appUrl}).`);
}
if (releases && !RELEASES_REPO_PATTERN.test(releases)) {
  throw new Error(
    `DESKTOP_RELEASES_REPO must look like owner/name (got ${releases}).`,
  );
}

const dist = join(desktopDir, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "assets"), { recursive: true });

const common = {
  bundle: true,
  minify: !dev,
  sourcemap: dev ? "inline" : false,
  logLevel: "warning",
  define: {
    __APP_URL__: JSON.stringify(url.origin),
    __APP_NAME__: JSON.stringify(name),
    __RELEASES_REPO__: JSON.stringify(releases),
    __DEV__: JSON.stringify(dev),
  },
};
const node = {
  ...common,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
};
await Promise.all([
  build({
    ...node,
    entryPoints: [join(desktopDir, "src/main/main.ts")],
    outfile: join(dist, "main.cjs"),
  }),
  build({
    ...node,
    entryPoints: [join(desktopDir, "src/preload/preload.ts")],
    outfile: join(dist, "preload.cjs"),
  }),
  build({
    ...node,
    entryPoints: [join(desktopDir, "src/preload/picker.ts")],
    outfile: join(dist, "picker-preload.cjs"),
  }),
  build({
    ...common,
    platform: "browser",
    format: "iife",
    target: "chrome130",
    entryPoints: [join(desktopDir, "src/picker/picker.ts")],
    outfile: join(dist, "picker/picker.js"),
  }),
]);
for (const file of ["index.html", "picker.css"]) {
  cpSync(join(desktopDir, "src/picker", file), join(dist, "picker", file));
}
for (const file of ["tray.png", "trayTemplate.png", "trayTemplate@2x.png"]) {
  cpSync(join(desktopDir, "build", file), join(dist, "assets", file));
}
console.log(`Built ${name} for ${url.origin}${dev ? " (development)" : ""}.`);

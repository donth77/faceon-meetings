// pnpm desktop:win [--publish]
//
// Builds the Windows installer (per-user NSIS, x64 and Arm64) into desktop/release.
// It's unsigned until a code-signing service is set up (desktop/RELEASING.md), so
// SmartScreen warns on first run. --publish uploads to the releases repository.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import builder from "electron-builder";

import { desktopDir, loadDesktopEnv } from "./env.mjs";

loadDesktopEnv();
const publish = process.argv.includes("--publish");
if (publish && !process.env.GH_TOKEN) {
  console.error("Publishing needs GH_TOKEN (see desktop/RELEASING.md).");
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [join(desktopDir, "scripts", "build.mjs")],
  {
    stdio: "inherit",
  },
);
if (result.status !== 0) process.exit(result.status ?? 1);

const require = createRequire(import.meta.url);
const config = require("../electron-builder.config.cjs");
const { build, Platform, Arch } = builder;
await build({
  projectDir: desktopDir,
  targets: Platform.WINDOWS.createTarget(["nsis"], Arch.x64, Arch.arm64),
  publish: publish ? "always" : "never",
  config,
});
console.log(
  `\nDone: desktop/release${publish ? " (uploaded to the releases repository's draft)" : ""}`,
);

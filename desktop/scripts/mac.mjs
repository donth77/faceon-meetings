// pnpm desktop:mac [--publish]
//
// Builds the Mac app on this Mac: a universal .dmg, plus the .zip and latest-mac.yml
// that updates need. With a "Developer ID Application" certificate in the login
// keychain it signs (hardened runtime and entitlements); with a notary profile or an
// App Store Connect key it also notarizes and staples. Without them it builds an
// unsigned app and says so. --publish uploads to the releases repository.
// Every step is in desktop/README.md.
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import builder from "electron-builder";

import { desktopDir, loadDesktopEnv } from "./env.mjs";

if (process.platform !== "darwin") {
  console.error(
    "Build the Mac app on a Mac (pnpm desktop:win builds Windows).",
  );
  process.exit(1);
}
loadDesktopEnv();
const publish = process.argv.includes("--publish");
const allowUnsigned = process.argv.includes("--allow-unsigned");

function developerId() {
  try {
    const identities = execFileSync(
      "security",
      ["find-identity", "-v", "-p", "codesigning"],
      { encoding: "utf8" },
    );
    return /"(Developer ID Application: [^"]+)"/.exec(identities)?.[1] ?? null;
  } catch {
    return null;
  }
}

function notaryCredentials() {
  const env = process.env;
  if (env.APPLE_KEYCHAIN_PROFILE)
    return `keychain profile "${env.APPLE_KEYCHAIN_PROFILE}"`;
  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) {
    return `App Store Connect key ${env.APPLE_API_KEY_ID}`;
  }
  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) {
    return `Apple ID ${env.APPLE_ID}`;
  }
  return null;
}

const identity = developerId();
const notary = identity ? notaryCredentials() : null;
if (identity) console.log(`Signing with ${identity}.`);
else {
  console.warn(
    '\n  UNSIGNED BUILD: no "Developer ID Application" certificate in your keychain.\n' +
      "  macOS will warn when it opens, and it can't update itself.\n" +
      '  To sign, follow "Signing on your Mac" in desktop/README.md.\n',
  );
}
if (identity && notary) console.log(`Notarizing with the ${notary}.`);
else if (identity) {
  console.warn(
    "\n  NOT NOTARIZED: set APPLE_KEYCHAIN_PROFILE (or an App Store Connect key) in\n" +
      "  desktop/.env.local. See desktop/README.md.\n",
  );
}
if (publish && !(identity && notary) && !allowUnsigned) {
  console.error(
    "Refusing to publish a Mac build that isn't signed and notarized: people couldn't\n" +
      "open it without a warning, and it couldn't update. (--allow-unsigned overrides.)",
  );
  process.exit(1);
}
if (publish && !process.env.GH_TOKEN) {
  console.error("Publishing needs GH_TOKEN (see desktop/README.md).");
  process.exit(1);
}

const run = (script, args = []) => {
  const result = spawnSync(
    process.execPath,
    [join(desktopDir, "scripts", script), ...args],
    {
      stdio: "inherit",
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("build.mjs");

const require = createRequire(import.meta.url);
const base = require("../electron-builder.config.cjs");
const { build, Platform, Arch } = builder;
await build({
  projectDir: desktopDir,
  targets: Platform.MAC.createTarget(["dmg", "zip"], Arch.universal),
  publish: publish ? "always" : "never",
  config: {
    ...base,
    mac: {
      ...base.mac,
      identity: identity ? undefined : null,
      notarize: Boolean(identity && notary),
    },
  },
});

// Check what was built.
const release = join(desktopDir, "release");
const appDir = readdirSync(join(release, "mac-universal")).find((name) =>
  name.endsWith(".app"),
);
const dmg = readdirSync(release).find((name) => name.endsWith(".dmg"));
const check = (label, command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  const ok = result.status === 0;
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok)
    console.log(
      (result.stderr || result.stdout).trim().split("\n").slice(-3).join("\n"),
    );
};
if (identity && appDir) {
  const app = join(release, "mac-universal", appDir);
  check("codesign --verify --deep --strict", "codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    app,
  ]);
  check("spctl -a (Gatekeeper accepts it)", "spctl", [
    "-a",
    "-vvv",
    "-t",
    "exec",
    app,
  ]);
}
if (identity && notary && dmg) {
  check("stapler validate (the .dmg carries its ticket)", "xcrun", [
    "stapler",
    "validate",
    join(release, dmg),
  ]);
}
console.log(
  `\nDone: desktop/release/${dmg ?? ""}${publish ? " (uploaded to the releases repository's draft)" : ""}`,
);

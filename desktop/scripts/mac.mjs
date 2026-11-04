// pnpm desktop:mac [--publish | --attach] [--allow-unsigned]
//
// Builds the Mac app: a universal .dmg, plus the .zip and latest-mac.yml that updates
// need. With a "Developer ID Application" certificate, in this Mac's login keychain or as
// a .p12 in CSC_LINK with CSC_KEY_PASSWORD (as the Mac release job on GitHub has it), it
// signs the app and the disk image (hardened runtime and entitlements). With a notary
// profile, an App Store Connect key or an Apple ID it also notarizes and staples both, then
// checks them and stops if a check fails. Without a certificate it builds an unsigned app
// and says so. --publish uploads the files to the version's draft release, making it
// first; --attach adds them to the version's release even once it's published, replacing
// the Mac files there. Every step is in desktop/RELEASING.md.
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import builder from "electron-builder";

import { desktopDir, loadDesktopEnv } from "./env.mjs";
import {
  acceptedAsNotarized,
  macReleaseFiles,
  notaryCredentials,
  signingSource,
} from "./mac-signing.mjs";
import {
  findRelease,
  prepareRelease,
  releaseTag,
  uploadReleaseFiles,
} from "./release.mjs";

if (process.platform !== "darwin") {
  console.error(
    "Build the Mac app on a Mac, or with the Mac release job on GitHub (pnpm desktop:win builds Windows).",
  );
  process.exit(1);
}
loadDesktopEnv();
const publish = process.argv.includes("--publish");
const attach = process.argv.includes("--attach");
const uploading = publish || attach;
const allowUnsigned = process.argv.includes("--allow-unsigned");

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(1);
}

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

const signer = signingSource(process.env, developerId());
const notary = signer ? notaryCredentials(process.env) : null;
if (signer) console.log(`Signing with ${signer}.`);
else {
  console.warn(
    '\n  UNSIGNED BUILD: no "Developer ID Application" certificate in your keychain or CSC_LINK.\n' +
      "  macOS will warn when it opens, and it can't update itself.\n" +
      '  To sign, follow "Signing on your Mac" or "Signing the Mac app on GitHub" in\n' +
      "  desktop/RELEASING.md.\n",
  );
}
if (signer && notary) console.log(`Notarizing with the ${notary.label}.`);
else if (signer) {
  console.warn(
    "\n  NOT NOTARIZED: set APPLE_KEYCHAIN_PROFILE (or an App Store Connect key) in\n" +
      "  desktop/.env.local. See desktop/RELEASING.md.\n",
  );
}

const repo = process.env.DESKTOP_RELEASES_REPO?.trim() ?? "";
const token = process.env.GH_TOKEN?.trim() ?? "";
if (publish && attach) {
  fail(
    "Choose --publish (a new version's draft) or --attach (a release that's out), not both.",
  );
}
if (uploading && !(signer && notary) && !allowUnsigned) {
  fail(
    "Refusing to publish a Mac build that isn't signed and notarized: people couldn't\n" +
      "open it without a warning, and it couldn't update. (--allow-unsigned overrides.)",
  );
}
if (uploading && !token)
  fail("Publishing needs GH_TOKEN (see desktop/RELEASING.md).");
if (uploading && !repo) {
  fail(
    "Publishing needs DESKTOP_RELEASES_REPO, the repository whose releases hold the app\n" +
      "(see desktop/RELEASING.md).",
  );
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
const version = require("../package.json").version;
if (publish) {
  try {
    await prepareRelease({ productName: base.productName, version });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
// Attaching needs a release to attach to: find out before the long build, not after.
if (attach) {
  const tag = releaseTag(version);
  const found = await findRelease({ repo, token, tag }).catch(
    (/** @type {unknown} */ error) =>
      fail(error instanceof Error ? error.message : String(error)),
  );
  if (!found) {
    fail(
      `${repo} has no release ${tag} to attach to: use --publish for a new version.`,
    );
  }
  console.log(
    `Attaching to ${repo}'s ${found?.draft ? "draft" : "published"} release ${tag}.`,
  );
}
const { build, Platform, Arch } = builder;
await build({
  projectDir: desktopDir,
  targets: Platform.MAC.createTarget(["dmg", "zip"], Arch.universal),
  // This script uploads the files itself, after notarizing the disk image too.
  publish: "never",
  config: {
    ...base,
    mac: {
      ...base.mac,
      identity: signer ? undefined : null,
      notarize: Boolean(signer && notary),
    },
    dmg: { ...base.dmg, sign: Boolean(signer) },
  },
});

const release = join(desktopDir, "release");
const appName = readdirSync(join(release, "mac-universal")).find((name) =>
  name.endsWith(".app"),
);
const dmg = readdirSync(release).find((name) => name.endsWith(".dmg"));
const app = appName ? join(release, "mac-universal", appName) : null;
const dmgPath = dmg ? join(release, dmg) : null;

/**
 * Runs one step, shows the end of what it said, and tells whether it passed.
 * @param {string} label
 * @param {string} command
 * @param {string[]} args
 * @param {(result: { status: number | null; output: string }) => boolean} [passed]
 */
function step(label, command, args, passed = ({ status }) => status === 0) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const ok = passed({ status: result.status, output });
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (output) {
    console.log(
      output
        .split("\n")
        .slice(-4)
        .map((line) => `    ${line}`)
        .join("\n"),
    );
  }
  return ok;
}

const releasing = Boolean(signer && notary);
let passed = true;
// electron-builder notarizes and staples the app; the disk image around it is done here.
if (releasing && dmgPath) {
  passed = step(
    "notarytool: Apple accepts the disk image",
    "xcrun",
    ["notarytool", "submit", dmgPath, ...(notary?.args ?? []), "--wait"],
    ({ status, output }) => status === 0 && /status: Accepted/.test(output),
  );
  if (passed) {
    passed = step("stapler: the disk image carries its ticket", "xcrun", [
      "stapler",
      "staple",
      dmgPath,
    ]);
  }
}
if (signer && app) {
  passed =
    step("codesign --verify --deep --strict", "codesign", [
      "--verify",
      "--deep",
      "--strict",
      "--verbose=2",
      app,
    ]) && passed;
  passed =
    step(
      "spctl: Gatekeeper accepts the app",
      "spctl",
      ["-a", "-vvv", "-t", "exec", app],
      releasing
        ? ({ status, output }) => status === 0 && acceptedAsNotarized(output)
        : undefined,
    ) && passed;
}
if (releasing && dmgPath) {
  passed =
    step("stapler validate: the disk image", "xcrun", [
      "stapler",
      "validate",
      dmgPath,
    ]) && passed;
  passed =
    step(
      "spctl: Gatekeeper accepts the disk image",
      "spctl",
      [
        "-a",
        "-vvv",
        "-t",
        "open",
        "--context",
        "context:primary-signature",
        dmgPath,
      ],
      ({ status, output }) => status === 0 && acceptedAsNotarized(output),
    ) && passed;
}
if (releasing && !passed) {
  fail(
    "\nA signing or notarization check failed (✗ above), so nothing was uploaded.",
  );
}

if (uploading) {
  const files = macReleaseFiles(readdirSync(release)).map((name) =>
    join(release, name),
  );
  if (!files.some((file) => file.endsWith("latest-mac.yml"))) {
    fail(
      "The build wrote no latest-mac.yml, which installed apps update from: is\n" +
        "DESKTOP_RELEASES_REPO set? Nothing was uploaded.",
    );
  }
  try {
    const names = await uploadReleaseFiles({
      repo,
      token,
      version,
      files,
      allowPublished: attach,
    });
    console.log(
      `\nUploaded to ${repo}'s release ${releaseTag(version)}: ${names.join(", ")}`,
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
console.log(
  `\nDone: desktop/release/${dmg ?? ""}${publish ? " (uploaded to the draft release)" : attach ? " (added to the release)" : ""}`,
);

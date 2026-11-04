// pnpm desktop:win [--publish]
//
// Builds the Windows installer (per-user NSIS, x64 and Arm64) into desktop/release.
// With the Artifact Signing settings in desktop/.env.local, and `az login` on this PC,
// it signs the app and the installer, then checks the signatures. Without them it builds
// an unsigned app and says so: Smart App Control won't open that, and SmartScreen warns.
// --publish uploads to the releases repository, signed builds only (--allow-unsigned
// overrides). Every step is in desktop/RELEASING.md.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import builder from "electron-builder";

import { desktopDir, loadDesktopEnv } from "./env.mjs";
import { prepareRelease } from "./release.mjs";
import {
  certificateName,
  publishRefusal,
  SIGNING_SETTINGS,
} from "./signing.mjs";

loadDesktopEnv();
const publish = process.argv.includes("--publish");
const allowUnsigned = process.argv.includes("--allow-unsigned");

const require = createRequire(import.meta.url);
const config = require("../electron-builder.config.cjs");
/** @type {import("./signing.mjs").AzureSignOptions | undefined} */
const signing = config.win.azureSignOptions;
if (signing) {
  console.log(
    `Signing with Artifact Signing: account ${signing.codeSigningAccountName}, certificate profile ${signing.certificateProfileName}.`,
  );
} else {
  const missing = SIGNING_SETTINGS.filter((name) => !process.env[name]?.trim());
  const why =
    missing.length === SIGNING_SETTINGS.length
      ? "no Artifact Signing settings"
      : `${missing.join(" and ")} ${missing.length === 1 ? "isn't" : "aren't"} set`;
  console.warn(
    `\n  UNSIGNED BUILD: ${why} in desktop/.env.local.\n` +
      "  PCs with Smart App Control on won't open it, and SmartScreen warns on the rest.\n" +
      '  To sign, follow "Signing on Windows" in desktop/RELEASING.md.\n',
  );
}
const refusal = publish
  ? publishRefusal({
      signed: Boolean(signing),
      allowUnsigned,
      token: process.env.GH_TOKEN,
    })
  : null;
if (refusal) {
  console.error(refusal);
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

if (publish) {
  await prepareRelease({
    productName: config.productName,
    version: require("../package.json").version,
  });
}
const { build, Platform, Arch } = builder;
await build({
  projectDir: desktopDir,
  targets: Platform.WINDOWS.createTarget(["nsis"], Arch.x64, Arch.arm64),
  publish: publish ? "always" : "never",
  config,
});

/**
 * Each file's Authenticode signature, as Windows sees it.
 * @param {string[]} files
 * @returns {{ Path: string; Status: string; Message: string; Signer: string | null; Timestamped: boolean }[]}
 */
function signatures(files) {
  const script =
    "[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false; " +
    "$results = @(foreach ($file in ($env:FACEON_SIGNED_FILES | ConvertFrom-Json)) { " +
    "$s = Get-AuthenticodeSignature -LiteralPath $file; " +
    "[pscustomobject]@{ Path = $file; Status = [string]$s.Status; Message = $s.StatusMessage; " +
    "Signer = $s.SignerCertificate.Subject; Timestamped = $null -ne $s.TimeStamperCertificate } }); " +
    "ConvertTo-Json -InputObject $results -Compress";
  const checked = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      env: { ...process.env, FACEON_SIGNED_FILES: JSON.stringify(files) },
    },
  );
  if (checked.status !== 0) {
    throw new Error(`Couldn't check the signatures: ${checked.stderr.trim()}`);
  }
  return [JSON.parse(checked.stdout.replace(/^\uFEFF/, ""))].flat();
}

// Check what was signed: the installer, and the app in each architecture's folder.
const release = join(desktopDir, "release");
if (signing) {
  const files = [
    join(release, config.nsis.artifactName.replace("${ext}", "exe")),
    ...readdirSync(release)
      .filter((folder) => folder.endsWith("-unpacked"))
      .flatMap((folder) =>
        readdirSync(join(release, folder))
          .filter((name) => name.endsWith(".exe"))
          .map((name) => join(release, folder, name)),
      ),
  ].filter((file) => existsSync(file));
  let ok = files.length > 0;
  /** Who signed them: each name (CN) with its certificate's whole subject. */
  const signers = new Map();
  for (const file of signatures(files)) {
    const label = relative(release, file.Path);
    const name = file.Signer ? certificateName(file.Signer) : null;
    if (file.Status === "Valid" && file.Timestamped && name) {
      signers.set(name, file.Signer);
      console.log(`✓ ${label}: signed by ${name}, timestamped`);
    } else {
      ok = false;
      console.log(
        `✗ ${label}: ${file.Status === "Valid" ? "not timestamped, so it stops being valid when the certificate expires" : `${file.Status} (${file.Message})`}`,
      );
    }
  }
  const [[name, subject] = []] = signers;
  if (signers.size > 1) {
    ok = false;
    console.log(
      `✗ signed by different names: ${[...signers.keys()].join(", ")}`,
    );
  } else if (name && !signing.publisherName) {
    console.log(
      `\nSet WINDOWS_PUBLISHER_NAME=${name} in desktop/.env.local, so installed apps accept only\nupdates signed by this name.`,
    );
  } else if (
    name &&
    signing.publisherName !== name &&
    signing.publisherName !== subject
  ) {
    ok = false;
    console.log(
      `✗ WINDOWS_PUBLISHER_NAME is "${signing.publisherName}", but the certificate says "${name}":\n  installed apps would refuse this update.`,
    );
  }
  if (!ok) {
    console.error(
      `\nThe signatures aren't right${publish ? ", so don't publish the draft release" : ""}.`,
    );
    process.exit(1);
  }
}
console.log(
  `\nDone: desktop/release${publish ? " (uploaded to the releases repository's draft)" : ""}`,
);

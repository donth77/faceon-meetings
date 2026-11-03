// electron-builder's settings for FaceOn's desktop app. scripts/mac.mjs and
// scripts/windows.mjs build with them; desktop/RELEASING.md explains each step.
const { azureSignOptions } = require("./scripts/signing.mjs");

const name = process.env.NEXT_PUBLIC_APP_NAME || "FaceOn";
const releases = process.env.DESKTOP_RELEASES_REPO || "";
const [owner, repo] = releases.split("/");
// The installers keep these names in every release, so the website can link to
// releases/latest/download/<name> (src/lib/desktop/downloads.ts, desktopAssetNames).
const fileBase =
  name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "FaceOn";
const signing = azureSignOptions(process.env);

/** @type {import("electron-builder").Configuration} */
module.exports = {
  appId: process.env.DESKTOP_APP_ID || "app.joinfaceon.desktop",
  productName: name,
  // The package's own name ("@faceon/desktop") would name the installer's files and
  // the updater's folder; the app's name reads better.
  extraMetadata: {
    name:
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "faceon",
    // Windows' publisher (installed apps, the app's file details); otherwise Electron's.
    author: { name: `${name} contributors` },
  },
  copyright: `Copyright © ${new Date().getFullYear()} ${name} contributors`,
  directories: { output: "release", buildResources: "build" },
  files: ["dist/**/*", "package.json"],
  // The app takes no node_modules: scripts/build.mjs bundles everything it runs into
  // dist/. Resolving false says so; otherwise electron-builder, finding no dependencies
  // here, packs the workspace root's (Next.js and the rest of the web app's).
  beforeBuild: async () => false,
  asar: true,
  protocols: [{ name: `${name} links`, schemes: ["faceon"] }],
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
  },
  mac: {
    category: "public.app-category.productivity",
    // The updater's zip; the disk image (dmg, below) is the download.
    artifactName: `${fileBase}-mac.\${ext}`,
    target: [
      { target: "dmg", arch: ["universal"] },
      { target: "zip", arch: ["universal"] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    extendInfo: {
      NSCameraUsageDescription: `${name} uses the camera in meetings.`,
      NSMicrophoneUsageDescription: `${name} uses the microphone in meetings.`,
      NSAudioCaptureUsageDescription: `${name} can share your computer's sound with your screen.`,
    },
  },
  dmg: { artifactName: `${fileBase}.\${ext}`, writeUpdateInfo: false },
  win: {
    target: [{ target: "nsis", arch: ["x64", "arm64"] }],
    // Signed with Azure Artifact Signing once its settings are set ("Signing on
    // Windows" in RELEASING.md); unsigned until then.
    ...(signing ? { azureSignOptions: signing } : {}),
  },
  nsis: {
    artifactName: `${fileBase}-Setup.\${ext}`,
    oneClick: true,
    perMachine: false,
    allowElevation: false,
    deleteAppDataOnUninstall: false,
  },
  publish:
    owner && repo
      ? [{ provider: "github", owner, repo, releaseType: "draft" }]
      : null,
};

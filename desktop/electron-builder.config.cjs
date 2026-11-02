// electron-builder's settings for FaceOn's desktop app. scripts/mac.mjs and
// scripts/windows.mjs build with them; desktop/README.md explains each step.
const name = process.env.NEXT_PUBLIC_APP_NAME || "FaceOn";
const releases = process.env.DESKTOP_RELEASES_REPO || "";
const [owner, repo] = releases.split("/");

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
  },
  copyright: `Copyright © ${new Date().getFullYear()} ${name} contributors`,
  directories: { output: "release", buildResources: "build" },
  files: ["dist/**/*", "package.json"],
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
  dmg: { writeUpdateInfo: false },
  win: {
    target: [{ target: "nsis", arch: ["x64", "arm64"] }],
  },
  nsis: {
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

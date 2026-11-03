// pnpm desktop:try
//
// The real app on this computer, without installing it: builds it unpacked (no
// installer, so no signing and no long-path trouble) and opens it. It's named and
// pictured as FaceOn, takes faceon:// links ("Open FaceOn?" in browsers), and opens
// FACEON_APP_URL (https://joinfaceon.app unless set). See desktop/DEVELOPING.md.
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import builder from "electron-builder";

import { registerAppId } from "./app-id.mjs";
import { desktopDir, loadDesktopEnv } from "./env.mjs";

loadDesktopEnv();
const built = spawnSync(
  process.execPath,
  [join(desktopDir, "scripts", "build.mjs")],
  { stdio: "inherit" },
);
if (built.status !== 0) process.exit(built.status ?? 1);

const require = createRequire(import.meta.url);
const config = require("../electron-builder.config.cjs");
const { build, Platform, Arch } = builder;
const platform =
  process.platform === "darwin"
    ? Platform.MAC
    : process.platform === "win32"
      ? Platform.WINDOWS
      : Platform.LINUX;
await build({
  projectDir: desktopDir,
  targets: platform.createTarget(
    ["dir"],
    process.arch === "arm64" ? Arch.arm64 : Arch.x64,
  ),
  publish: "never",
  // Unsigned: it runs on the computer that built it.
  config: {
    ...config,
    mac: { ...config.mac, identity: null, notarize: false },
  },
});

const release = join(desktopDir, "release");
const folder = readdirSync(release).find((name) =>
  process.platform === "darwin"
    ? name.startsWith("mac")
    : name.endsWith("unpacked"),
);
if (!folder) throw new Error("The unpacked app isn't in desktop/release.");
const name = config.productName;
// Notifications, as FaceOn: Windows knows an installed copy by its Start menu shortcut.
registerAppId(config.appId, name);
const app =
  process.platform === "darwin"
    ? join(release, folder, `${name}.app`)
    : join(
        release,
        folder,
        process.platform === "win32" ? `${name}.exe` : name,
      );
const child =
  process.platform === "darwin"
    ? spawn("open", ["-n", app], { detached: true, stdio: "ignore" })
    : spawn(app, [], { detached: true, stdio: "ignore" });
child.unref();
console.log(`Opened ${app}`);

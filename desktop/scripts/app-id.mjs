// Windows shows notifications only from apps it knows, by their app ID. The installer's
// Start menu shortcut introduces an installed copy; this introduces one that isn't
// (pnpm desktop:dev, pnpm desktop:try) to Windows for this user, with FaceOn's name and
// icon: HKCU\Software\Classes\AppUserModelId\<app ID>.
//
//   node scripts/app-id.mjs --dev    the development app's ID (the app adds ".dev")
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { desktopDir, loadDesktopEnv } from "./env.mjs";

/** Lets Windows show notifications from `id` as `name`, with the app's icon. */
export function registerAppId(id, name) {
  if (process.platform !== "win32") return;
  const key = `HKCU\\Software\\Classes\\AppUserModelId\\${id}`;
  for (const [value, data] of [
    ["DisplayName", name],
    ["IconUri", join(desktopDir, "build", "icon.png")],
  ]) {
    spawnSync(
      "reg",
      ["add", key, "/v", value, "/t", "REG_SZ", "/d", data, "/f"],
      { stdio: "ignore" },
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadDesktopEnv();
  const config = createRequire(import.meta.url)(
    "../electron-builder.config.cjs",
  );
  const dev = process.argv.includes("--dev");
  registerAppId(dev ? `${config.appId}.dev` : config.appId, config.productName);
}

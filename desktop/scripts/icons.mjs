// The app's icons, from the brand (pnpm brand): build/icon.png for electron-builder
// (it makes the .icns and .ico), the macOS menu-bar template and the Windows tray icon.
// Run it after pnpm brand: pnpm desktop:icons.
import { join } from "node:path";
import sharp from "sharp";

import { desktopDir } from "./env.mjs";

const repo = join(desktopDir, "..");
const appIcon = join(repo, "src/app/icon.svg");
const mark = join(repo, "brand/mark.svg");
const out = (file) => join(desktopDir, "build", file);

await sharp(appIcon, { density: 1200 })
  .resize(1024, 1024)
  .png()
  .toFile(out("icon.png"));
await sharp(appIcon, { density: 600 })
  .resize(32, 32)
  .png()
  .toFile(out("tray.png"));

// macOS draws menu-bar icons from their shape alone: black, with the mark's outline.
for (const [size, file] of [
  [16, "trayTemplate.png"],
  [32, "trayTemplate@2x.png"],
]) {
  const alpha = await sharp(mark, { density: 1200 })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .extractChannel(3)
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 3, background: "#000000" },
  })
    .joinChannel(alpha)
    .png()
    .toFile(out(file));
}
console.log(
  "Wrote desktop/build/icon.png, tray.png and the menu-bar templates.",
);

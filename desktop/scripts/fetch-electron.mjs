// Downloads Electron's binary for this computer, once. pnpm doesn't run Electron's own
// install script (it isn't in onlyBuiltDependencies), so web installs and Vercel never
// download it; the desktop scripts fetch it when they need it.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const electronDir = dirname(require.resolve("electron/package.json"));
const pathFile = join(electronDir, "path.txt");
const ready =
  existsSync(pathFile) &&
  existsSync(join(electronDir, "dist", readFileSync(pathFile, "utf8").trim()));
if (!ready) {
  console.log("Downloading Electron…");
  await import(pathToFileURL(join(electronDir, "install.js")).href);
}

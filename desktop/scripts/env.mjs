import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** desktop/, wherever the script is run from. */
export const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The owner's settings for building the app: desktop/.env.local (git-ignored), then
 * the environment. See desktop/README.md for each one.
 */
export function loadDesktopEnv() {
  const file = join(desktopDir, ".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

export const RELEASES_REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

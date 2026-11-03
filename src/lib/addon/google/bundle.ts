import "server-only";

import bundle from "./bundle.generated.json";
import type { AddonBundle } from "./content";

/**
 * The add-on every person's copy is made from, with its version. `node
 * google-addon/build.mjs --bundle` makes it before dev, build, test and typecheck; it
 * isn't committed.
 */
export const ADDON_BUNDLE: AddonBundle = bundle;

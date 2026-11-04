import { z } from "zod";

/**
 * Zod, set to parse the plain way. Its faster mode compiles validators with Function(),
 * which the Content Security Policy doesn't allow, and only checking whether it may would
 * be reported on every page; plain parsing costs nothing noticeable at FaceOn's sizes.
 * Import it from here rather than "zod", so the setting always comes first, and so a page
 * that never parses anything in the browser doesn't load it.
 */
z.config({ jitless: true });

export { z };

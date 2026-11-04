import { app, type Session } from "electron";

import { appUrl } from "./config";
import { languageFor, setLanguage } from "./strings";

/** The cookie the web app keeps a chosen language in. */
const LANGUAGE_COOKIE = "NEXT_LOCALE";

/**
 * Keeps the shell in the web app's language: the one chosen in FaceOn (its cookie in the
 * window's session), else the system's, as the web app itself would pick it. The system's
 * applies at once; `changed` rebuilds the menus and the tray when that changes.
 */
export function followLanguage(ses: Session, changed: () => void): void {
  const system = app.getPreferredSystemLanguages();
  setLanguage(languageFor(system));
  async function update() {
    const [chosen] = await ses.cookies
      .get({ url: appUrl("/"), name: LANGUAGE_COOKIE })
      .catch(() => []);
    if (setLanguage(languageFor([chosen?.value, ...system]))) changed();
  }
  void update();
  ses.cookies.on("changed", (_event, cookie) => {
    if (cookie.name === LANGUAGE_COOKIE) void update();
  });
}

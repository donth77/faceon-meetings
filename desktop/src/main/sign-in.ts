import { shell, type BrowserWindow } from "electron";

import { APP_ORIGIN, appUrl } from "./config";
import { PendingSignIns } from "./sign-in-flow";

/**
 * Google and GitHub sign-in through the system browser (Google refuses sign-in inside
 * embedded browsers). See "Signing in" in desktop/DEVELOPING.md.
 */
export class SignIn {
  private readonly pending = new PendingSignIns();

  /** Opens the site's /desktop/sign-in in the browser, with this sign-in's challenge. */
  start(provider: "google" | "github") {
    const { state, challenge } = this.pending.start(Date.now());
    const url = new URL("/desktop/sign-in", APP_ORIGIN);
    url.search = new URLSearchParams({ state, challenge, provider }).toString();
    void shell.openExternal(url.toString());
  }

  /**
   * The browser's hand-back, faceon://auth: the one-time token plus the verifier only
   * this app has, exchanged for the window's own session. Both travel in a header, so
   * neither shows up in a URL or a request log.
   */
  finish(win: BrowserWindow, state: string, token: string): boolean {
    const verifier = this.pending.take(state, Date.now());
    if (!verifier) return false;
    void win.loadURL(appUrl("/api/auth/desktop/session"), {
      extraHeaders: `X-FaceOn-Handoff: ${token}.${verifier}\n`,
    });
    return true;
  }
}

import {
  shell,
  type BrowserWindow,
  type Session,
  type WebContents,
} from "electron";

import { APP_ORIGIN } from "./config";
import { decideNavigation, decidePermission } from "./policy";

/** Permissions for the app's partition: its own origin, and only what a meeting needs. */
export function secureSession(ses: Session) {
  ses.setPermissionRequestHandler(
    (_contents, permission, callback, details) => {
      const media = "mediaTypes" in details ? details.mediaTypes : undefined;
      callback(
        decidePermission(permission, details.requestingUrl, APP_ORIGIN, media),
      );
    },
  );
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    decidePermission(permission, requestingOrigin, APP_ORIGIN),
  );
}

/**
 * Keeps a window's pages on the app's origin. Links elsewhere open in the browser,
 * other schemes do nothing, and pop-ups never open inside the app, except Document
 * picture-in-picture's about:blank window, which `onPictureInPicture` keeps on top.
 */
export function guardContents(
  contents: WebContents,
  onPictureInPicture: (window: BrowserWindow) => void,
) {
  const stay = (event: { preventDefault(): void }, url: string) => {
    const decision = decideNavigation(url, APP_ORIGIN);
    if (decision === "allow") return;
    event.preventDefault();
    if (decision === "external") void shell.openExternal(url);
  };
  contents.on("will-navigate", (event) => stay(event, event.url));
  contents.on("will-redirect", (event) => stay(event, event.url));
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { alwaysOnTop: true },
      };
    }
    // Pages of this site opened "in a new tab" go to the browser too, so a meeting
    // in the window is never replaced.
    if (decideNavigation(url, APP_ORIGIN) !== "deny") {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  contents.on("did-create-window", (child) => {
    guardContents(child.webContents, onPictureInPicture);
    onPictureInPicture(child);
  });
}

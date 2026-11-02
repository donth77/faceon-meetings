import {
  app,
  nativeImage,
  type BrowserWindow,
  type NativeImage,
} from "electron";

import { strings } from "./strings";

let dot: NativeImage | undefined;

/** A red dot for the Windows taskbar button. */
function redDot(): NativeImage {
  const size = 16;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 6.5 ** 2;
      // BGRA.
      pixels.set(
        inside ? [0x3b, 0x30, 0xe5, 0xff] : [0, 0, 0, 0],
        (y * size + x) * 4,
      );
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

/** Unread chat on the dock (macOS) or the taskbar button (Windows). */
export function showUnread(
  win: BrowserWindow | null,
  count: number,
  enabled: boolean,
) {
  const shown = enabled ? count : 0;
  if (process.platform === "darwin") {
    app.dock?.setBadge(shown > 0 ? (shown > 99 ? "99+" : String(shown)) : "");
  } else if (process.platform === "win32") {
    if (!win || win.isDestroyed()) return;
    win.setOverlayIcon(
      shown > 0 ? (dot ??= redDot()) : null,
      shown > 0 ? strings.unread(shown) : "",
    );
  } else {
    app.setBadgeCount(shown);
  }
}

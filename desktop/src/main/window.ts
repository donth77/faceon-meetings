import { join } from "node:path";
import { app, BrowserWindow, nativeTheme, screen } from "electron";

import { APP_NAME, APP_ORIGIN, HIDDEN, PARTITION } from "./config";
import type { Store } from "./store";
import { firstWindowSize } from "./window-size";

/** The main window: the hosted app, at the size and place it was last left. */
export function createMainWindow(store: Store): BrowserWindow {
  const saved = store.get().window;
  const visible =
    saved !== undefined &&
    screen.getAllDisplays().some(({ workArea: area }) => {
      return (
        saved.x < area.x + area.width &&
        saved.x + saved.width > area.x &&
        saved.y < area.y + area.height &&
        saved.y + saved.height > area.y
      );
    });
  const first = firstWindowSize(
    screen.getPrimaryDisplay().workArea,
    process.platform,
  );
  const win = new BrowserWindow({
    width: saved?.width ?? first.width,
    height: saved?.height ?? first.height,
    ...(visible && saved ? { x: saved.x, y: saved.y } : {}),
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: APP_NAME,
    // macOS uses the app's own icon; elsewhere the window (and taskbar) shows this one.
    ...(process.platform === "darwin"
      ? {}
      : { icon: join(__dirname, "assets", "icon.png") }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f1115" : "#f5f6f8",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      partition: PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      additionalArguments: [
        `--faceon-origin=${APP_ORIGIN}`,
        `--faceon-version=${app.getVersion()}`,
      ],
    },
  });
  if (visible && saved?.maximized) win.maximize();
  win.once("ready-to-show", () => {
    if (!HIDDEN) win.show();
  });

  let timer: NodeJS.Timeout | undefined;
  const remember = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized()) return;
      const bounds = win.getNormalBounds();
      store.update((state) => ({
        ...state,
        window: { ...bounds, maximized: win.isMaximized() },
      }));
    }, 400);
  };
  win.on("resize", remember);
  win.on("move", remember);
  win.on("maximize", remember);
  win.on("unmaximize", remember);
  return win;
}

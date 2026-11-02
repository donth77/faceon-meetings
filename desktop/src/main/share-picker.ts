import { join } from "node:path";
import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  nativeTheme,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Session,
} from "electron";
import { z } from "zod";

import { APP_ORIGIN, HIDDEN } from "./config";

const Choice = z.object({ id: z.string().max(256), sound: z.boolean() });
type Choice = z.infer<typeof Choice>;

export type PickerSource = {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string | null;
  icon: string | null;
};

let picking = false;

/**
 * Screen sharing's picker: screens and windows with live thumbnails and, on Windows,
 * the computer's sound. macOS 15 and later show the system's own picker instead.
 */
export function installSharePicker(
  ses: Session,
  parent: () => BrowserWindow | null,
) {
  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      let origin = "";
      try {
        origin = new URL(request.securityOrigin).origin;
      } catch {
        // Not a page of the app.
      }
      if (origin !== APP_ORIGIN || picking) {
        callback({});
        return;
      }
      void pick(parent()).then(async (choice) => {
        if (!choice) return callback({});
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
        });
        const source = sources.find((candidate) => candidate.id === choice.id);
        if (!source) return callback({});
        callback(
          choice.sound && process.platform === "win32"
            ? { video: source, audio: "loopback" }
            : { video: source },
        );
      });
    },
    { useSystemPicker: true },
  );
}

async function listSources(): Promise<PickerSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 200 },
    fetchWindowIcons: true,
  });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.id.startsWith("screen:") ? "screen" : "window",
    thumbnail: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
    icon:
      source.appIcon && !source.appIcon.isEmpty()
        ? source.appIcon.toDataURL()
        : null,
  }));
}

function pick(parent: BrowserWindow | null): Promise<Choice | null> {
  picking = true;
  const win = new BrowserWindow({
    ...(parent ? { parent, modal: true } : {}),
    width: 760,
    height: 600,
    minWidth: 520,
    minHeight: 420,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#16191f" : "#ffffff",
    webPreferences: {
      preload: join(__dirname, "picker-preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  return new Promise((resolve) => {
    let done = false;
    const fromPicker = (event: IpcMainEvent | IpcMainInvokeEvent) =>
      !win.isDestroyed() && event.sender === win.webContents;
    const onChoose = (event: IpcMainEvent, value: unknown) => {
      if (!fromPicker(event)) return;
      const parsed = Choice.safeParse(value);
      finish(parsed.success ? parsed.data : null);
    };
    const onCancel = (event: IpcMainEvent) => {
      if (fromPicker(event)) finish(null);
    };
    function finish(choice: Choice | null) {
      if (done) return;
      done = true;
      picking = false;
      ipcMain.removeHandler("picker:sources");
      ipcMain.removeListener("picker:choose", onChoose);
      ipcMain.removeListener("picker:cancel", onCancel);
      if (!win.isDestroyed()) win.destroy();
      resolve(choice);
    }
    ipcMain.handle("picker:sources", (event) => {
      if (!fromPicker(event)) throw new Error("Not allowed");
      return listSources();
    });
    ipcMain.on("picker:choose", onChoose);
    ipcMain.on("picker:cancel", onCancel);
    win.on("closed", () => finish(null));
    win.once("ready-to-show", () => {
      if (!HIDDEN) win.show();
    });
    void win.loadFile(join(__dirname, "picker", "index.html"), {
      query: { platform: process.platform },
    });
  });
}

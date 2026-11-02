import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import type {
  DesktopCommand,
  DesktopUpdateState,
  FaceonDesktop,
} from "../../../src/lib/desktop/bridge";

const argument = (name: string) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);

const origin = argument("faceon-origin");

/**
 * window.faceonDesktop (src/lib/desktop/bridge.ts), for the app's own origin only. It
 * passes messages to the main process, which checks each one again (ipc.ts). Nothing
 * of Node or Electron reaches the page.
 */
if (origin && window.location.origin === origin) {
  const listen = <T>(channel: string, handler: (value: T) => void) => {
    const listener = (_event: IpcRendererEvent, value: T) => handler(value);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
  const bridge: FaceonDesktop = {
    bridge: 1,
    version: argument("faceon-version") ?? "0.0.0",
    platform:
      process.platform === "darwin"
        ? "mac"
        : process.platform === "win32"
          ? "windows"
          : "linux",
    meeting: (state) => ipcRenderer.send("faceon:meeting", state),
    onCommand: (handler) => listen<DesktopCommand>("faceon:command", handler),
    setUnread: (count) => ipcRenderer.send("faceon:unread", count),
    setReminderMinutes: (minutes) =>
      ipcRenderer.send("faceon:reminderMinutes", minutes),
    preferences: {
      get: () => ipcRenderer.invoke("faceon:preferences:get"),
      set: (change) => ipcRenderer.invoke("faceon:preferences:set", change),
    },
    updates: {
      get: () => ipcRenderer.invoke("faceon:updates:get"),
      check: () => ipcRenderer.send("faceon:updates:check"),
      install: () => ipcRenderer.send("faceon:updates:install"),
      onChange: (handler) =>
        listen<DesktopUpdateState>("faceon:updates:state", handler),
    },
    signIn: (provider) => ipcRenderer.send("faceon:signIn", provider),
    openInBrowser: (path) => ipcRenderer.send("faceon:openInBrowser", path),
    keepOnTop: (on) => ipcRenderer.send("faceon:keepOnTop", on),
  };
  contextBridge.exposeInMainWorld("faceonDesktop", bridge);
}

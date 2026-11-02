import { contextBridge, ipcRenderer } from "electron";

/** The share picker's page (src/picker): its sources, and the choice or cancel. */
if (window.location.protocol === "file:") {
  contextBridge.exposeInMainWorld("picker", {
    platform: process.platform,
    sources: () => ipcRenderer.invoke("picker:sources"),
    choose: (id: string, sound: boolean) =>
      ipcRenderer.send("picker:choose", { id, sound }),
    cancel: () => ipcRenderer.send("picker:cancel"),
  });
}

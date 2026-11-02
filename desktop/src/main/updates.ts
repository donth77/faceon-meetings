import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { autoUpdater } from "electron-updater";

import type { DesktopUpdateState } from "../../../src/lib/desktop/bridge";
import { RELEASES_REPO } from "./config";

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Whether this Mac app is signed: Squirrel.Mac installs updates only into signed apps. */
function macAppSigned(): Promise<boolean> {
  const bundle = join(process.execPath, "..", "..", "..");
  return new Promise((resolve) => {
    execFile("codesign", ["--verify", "--deep", "--strict", bundle], (error) =>
      resolve(!error),
    );
  });
}

/**
 * Updates from the releases repository: checked at start and every 6 hours, downloaded
 * in the background and installed on restart. An unsigned Mac app only says a new
 * version is out, with a link to download it.
 */
export class Updates {
  private state: DesktopUpdateState = { status: "disabled" };
  private readonly listeners = new Set<(state: DesktopUpdateState) => void>();
  private version = "";
  private signed = true;

  async start(channel: "latest" | "beta") {
    const configured =
      app.isPackaged &&
      RELEASES_REPO !== "" &&
      existsSync(join(process.resourcesPath, "app-update.yml"));
    if (!configured) return;
    this.signed = process.platform !== "darwin" || (await macAppSigned());
    autoUpdater.autoDownload = this.signed;
    autoUpdater.autoInstallOnAppQuit = this.signed;
    autoUpdater.logger = null;
    this.setChannel(channel);
    autoUpdater.on("checking-for-update", () =>
      this.set({ status: "checking" }),
    );
    autoUpdater.on("update-not-available", () =>
      this.set({ status: "upToDate", checkedAt: Date.now() }),
    );
    autoUpdater.on("update-available", (info) => {
      this.version = info.version;
      if (!this.signed) {
        this.set({
          status: "manual",
          version: info.version,
          url: `https://github.com/${RELEASES_REPO}/releases/latest`,
        });
      }
    });
    autoUpdater.on("download-progress", (progress) =>
      this.set({
        status: "downloading",
        version: this.version,
        percent: Math.round(progress.percent),
      }),
    );
    autoUpdater.on("update-downloaded", (info) =>
      this.set({ status: "ready", version: info.version }),
    );
    autoUpdater.on("error", () => this.set({ status: "failed" }));
    this.set({ status: "idle" });
    this.check();
    setInterval(() => this.check(), SIX_HOURS);
  }

  setChannel(channel: "latest" | "beta") {
    autoUpdater.allowPrerelease = channel === "beta";
  }

  check() {
    const { status } = this.state;
    if (
      status === "disabled" ||
      status === "downloading" ||
      status === "ready"
    ) {
      return;
    }
    void autoUpdater
      .checkForUpdates()
      .catch(() => this.set({ status: "failed" }));
  }

  install() {
    if (this.state.status === "ready") autoUpdater.quitAndInstall();
  }

  get(): DesktopUpdateState {
    return this.state;
  }

  onChange(listener: (state: DesktopUpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(state: DesktopUpdateState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

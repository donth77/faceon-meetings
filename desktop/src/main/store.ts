import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

import { parseAppState, type AppState } from "./schemas";

/**
 * The app's own state in userData/state.json: Settings → Desktop app, the reminder time
 * copied from the web app, and where the window was.
 */
export class Store {
  private state: AppState;
  private readonly file = join(app.getPath("userData"), "state.json");

  constructor() {
    let raw: unknown = {};
    try {
      raw = JSON.parse(readFileSync(this.file, "utf8"));
    } catch {
      // First run, or unreadable: the defaults.
    }
    this.state = parseAppState(raw);
  }

  get(): AppState {
    return this.state;
  }

  update(change: (state: AppState) => AppState): AppState {
    this.state = change(this.state);
    const temporary = `${this.file}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(this.state, null, 2));
      renameSync(temporary, this.file);
    } catch {
      // A full or read-only disk: it lasts until the app quits.
    }
    return this.state;
  }
}

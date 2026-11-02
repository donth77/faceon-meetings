import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";

import type {
  DesktopMeetingState,
  DesktopPreferences,
  DesktopReminderMinutes,
  DesktopUpdateState,
} from "../../../src/lib/desktop/bridge";
import { APP_ORIGIN } from "./config";
import {
  AppPath,
  MeetingState,
  PreferencesChange,
  Provider,
  ReminderMinutes,
  Unread,
} from "./schemas";

export type BridgeHandlers = {
  meeting(state: DesktopMeetingState): void;
  unread(count: number): void;
  reminderMinutes(minutes: DesktopReminderMinutes): void;
  getPreferences(): DesktopPreferences;
  setPreferences(change: Partial<DesktopPreferences>): DesktopPreferences;
  getUpdates(): DesktopUpdateState;
  checkUpdates(): void;
  installUpdate(): void;
  signIn(provider: "google" | "github"): void;
  openInBrowser(path: string): void;
  keepOnTop(on: boolean): void;
};

/** Bridge calls count only from the app's own pages. */
function fromApp(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  try {
    return new URL(event.senderFrame?.url ?? "").origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * The main-process side of window.faceonDesktop (preload.ts): each message is checked
 * for where it came from and what it holds before anything happens. There's no generic
 * channel, and nothing here runs code from the page.
 */
export function handleBridge(handlers: BridgeHandlers) {
  const on = <T>(
    channel: string,
    schema: z.ZodType<T>,
    run: (value: T) => void,
  ) => {
    ipcMain.on(channel, (event, value: unknown) => {
      if (!fromApp(event)) return;
      const parsed = schema.safeParse(value);
      if (parsed.success) run(parsed.data);
    });
  };
  const handle = <T>(channel: string, run: (value: unknown) => T) => {
    ipcMain.handle(channel, (event, value: unknown) => {
      if (!fromApp(event)) throw new Error("Not allowed");
      return run(value);
    });
  };

  on("faceon:meeting", MeetingState, handlers.meeting);
  on("faceon:unread", Unread, handlers.unread);
  on("faceon:reminderMinutes", ReminderMinutes, handlers.reminderMinutes);
  on("faceon:updates:check", z.undefined(), () => handlers.checkUpdates());
  on("faceon:updates:install", z.undefined(), () => handlers.installUpdate());
  on("faceon:signIn", Provider, handlers.signIn);
  on("faceon:openInBrowser", AppPath, handlers.openInBrowser);
  on("faceon:keepOnTop", z.boolean(), handlers.keepOnTop);
  handle("faceon:preferences:get", () => handlers.getPreferences());
  handle("faceon:preferences:set", (value) =>
    handlers.setPreferences(PreferencesChange.parse(value)),
  );
  handle("faceon:updates:get", () => handlers.getUpdates());
}

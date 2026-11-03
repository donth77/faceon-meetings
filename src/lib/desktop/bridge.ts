/**
 * The desktop app's bridge, `window.faceonDesktop`: what the web app can ask of the
 * FaceOn app for macOS and Windows. It exists only inside that app, and only on the
 * app's own origin. The app (desktop/) imports these types, so the two can't drift;
 * its main process checks every call again before doing anything.
 */
export const BRIDGE_VERSION = 1;

export type DesktopPlatform = "mac" | "windows" | "linux";

/** What the app asks of the page: the tray's and the global shortcut's actions. */
export type DesktopCommand =
  { type: "toggleMute" } | { type: "leave" } | { type: "open"; path: string };

/** Settings → Notifications' reminder, copied into the app for when no window is open. */
export type DesktopReminderMinutes = 0 | 5 | 10 | 15;

/** Settings → Desktop app. Kept by the app, on this computer. */
export type DesktopPreferences = {
  /** Open the app when you sign in to your computer. */
  launchAtLogin: boolean;
  /** Closing the window keeps the app in the tray or menu bar. */
  keepInTray: boolean;
  /** Mute or unmute from any app during a meeting, e.g. "CommandOrControl+Shift+A". */
  muteShortcut: { enabled: boolean; accelerator: string };
  /** Unread chat on the dock or taskbar. */
  badge: boolean;
};

export type DesktopUpdateState =
  /** Not a packaged build, or no place to get updates from. */
  | { status: "disabled" }
  | { status: "idle" }
  | { status: "checking" }
  | { status: "upToDate"; checkedAt: number }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  /** An unsigned Mac app can't update itself: the new version is a download. */
  | { status: "manual"; version: string; url: string }
  | { status: "failed" };

export type DesktopMeetingState = {
  inMeeting: boolean;
  muted: boolean;
  title?: string;
};

export type FaceonDesktop = {
  bridge: typeof BRIDGE_VERSION;
  /** The app's version, e.g. "1.0.0". */
  version: string;
  platform: DesktopPlatform;
  meeting(state: DesktopMeetingState): void;
  onCommand(handler: (command: DesktopCommand) => void): () => void;
  setUnread(count: number): void;
  setReminderMinutes(minutes: DesktopReminderMinutes): void;
  preferences: {
    get(): Promise<DesktopPreferences>;
    set(change: Partial<DesktopPreferences>): Promise<DesktopPreferences>;
  };
  updates: {
    get(): Promise<DesktopUpdateState>;
    check(): void;
    install(): void;
    onChange(handler: (state: DesktopUpdateState) => void): () => void;
  };
  /** Google and GitHub sign-in, in the system browser (Google refuses embedded ones). */
  signIn(provider: "google" | "github"): void;
  /** A path on this site, opened in the system browser, e.g. "/settings/calendar". */
  openInBrowser(path: string): void;
  /** Whether the meeting's picture-in-picture window stays above other apps. */
  keepOnTop(on: boolean): void;
};

declare global {
  interface Window {
    faceonDesktop?: FaceonDesktop;
  }
}

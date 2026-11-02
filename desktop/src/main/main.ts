import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Notification,
  session,
  shell,
} from "electron";

import type {
  DesktopCommand,
  DesktopMeetingState,
} from "../../../src/lib/desktop/bridge";
import { showUnread } from "./badge";
import {
  APP_NAME,
  appUrl,
  HIDDEN,
  PARTITION,
  PROTOCOL,
  RELEASES_REPO,
} from "./config";
import { handleBridge } from "./ipc";
import { linkInArgv, parseAppLink } from "./links";
import { buildAppMenu } from "./menu";
import type { UpcomingMeeting } from "./reminder-schedule";
import { Reminders } from "./reminders";
import { guardContents, secureSession } from "./security";
import { installSharePicker } from "./share-picker";
import { MuteShortcut } from "./shortcut";
import { SignIn } from "./sign-in";
import { Store } from "./store";
import { strings } from "./strings";
import { createTray } from "./tray";
import { Updates } from "./updates";
import { createMainWindow } from "./window";

// One app at a time: a second launch (a faceon:// link, on Windows) hands its link to
// the first and quits.
if (app.requestSingleInstanceLock()) run();
else app.quit();

function registerProtocol(on: boolean) {
  // Tests run hidden, and leave the computer's link handlers alone.
  if (HIDDEN) return;
  if (!on) {
    app.removeAsDefaultProtocolClient(PROTOCOL);
  } else if (process.defaultApp) {
    // Development: this Electron, with this folder.
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      app.getAppPath(),
    ]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

function run() {
  const store = new Store();
  const signIn = new SignIn();
  const updates = new Updates();
  let win: BrowserWindow | null = null;
  let quitting = false;
  let meeting: DesktopMeetingState = { inMeeting: false, muted: false };
  let unread = 0;
  let next: UpcomingMeeting | null = null;
  let activeShortcut: string | null = null;
  let keepPictureOnTop = true;
  let tray: ReturnType<typeof createTray> | null = null;
  let reminders: Reminders | null = null;
  let pendingLink = linkInArgv(process.argv);

  const preferences = () => store.get().preferences;
  const send = (command: DesktopCommand) =>
    win?.webContents.send("faceon:command", command);
  const shortcut = new MuteShortcut(() => send({ type: "toggleMute" }));

  const refreshTray = () =>
    tray?.render({
      inMeeting: meeting.inMeeting,
      muted: meeting.muted,
      accelerator: activeShortcut,
      next,
    });
  const syncShortcut = () => {
    const { enabled, accelerator } = preferences().muteShortcut;
    activeShortcut = shortcut.sync({
      enabled,
      accelerator,
      inMeeting: meeting.inMeeting,
    });
    refreshTray();
  };

  function openWindow(): BrowserWindow {
    const created = createMainWindow(store);
    guardContents(created.webContents, (child) =>
      child.setAlwaysOnTop(keepPictureOnTop, "floating"),
    );
    created.on("close", (event) => {
      const stay = process.platform === "darwin" || preferences().keepInTray;
      if (!quitting && stay) {
        event.preventDefault();
        created.hide();
      }
    });
    created.on("closed", () => {
      if (win === created) win = null;
      meeting = { inMeeting: false, muted: false };
      syncShortcut();
    });
    void created.loadURL(appUrl("/home"));
    return created;
  }

  const show = (): BrowserWindow => {
    if (!win || win.isDestroyed()) win = openWindow();
    if (win.isMinimized()) win.restore();
    if (!HIDDEN) {
      win.show();
      win.focus();
    }
    return win;
  };
  const openPath = (path: string) => void show().loadURL(appUrl(path));

  function handleLink(raw: string) {
    const link = parseAppLink(raw);
    if (!link) return;
    if (link.kind === "auth") {
      signIn.finish(show(), link.state, link.token);
      reminders?.refresh();
      return;
    }
    if (meeting.inMeeting) {
      // Never drop a meeting in progress: the page asks first.
      show();
      send({ type: "open", path: link.path });
      return;
    }
    openPath(link.path);
  }

  const quit = () => {
    quitting = true;
    app.quit();
  };

  async function checkForUpdatesFromMenu() {
    const state = updates.get();
    if (state.status === "disabled") {
      await dialog.showMessageBox({ message: strings.updatesOff });
      return;
    }
    updates.check();
    show();
    openPath("/settings/desktop");
  }

  app.on("second-instance", (_event, argv) => {
    const link = linkInArgv(argv);
    if (link) handleLink(link);
    else show();
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (app.isReady()) handleLink(url);
    else pendingLink = url;
  });
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && !preferences().keepInTray) app.quit();
  });

  void app.whenReady().then(() => {
    registerProtocol(preferences().openLinksInApp);
    const ses = session.fromPartition(PARTITION);
    secureSession(ses);
    installSharePicker(ses, () => win);

    handleBridge({
      meeting(state) {
        meeting = state;
        syncShortcut();
      },
      unread(count) {
        unread = count;
        showUnread(win, unread, preferences().badge);
      },
      reminderMinutes(minutes) {
        store.update((state) => ({ ...state, reminderMinutes: minutes }));
      },
      getPreferences: preferences,
      setPreferences(change) {
        const updated = store.update((state) => ({
          ...state,
          preferences: { ...state.preferences, ...change },
        })).preferences;
        if (app.isPackaged) {
          app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin });
        }
        registerProtocol(updated.openLinksInApp);
        updates.setChannel(updated.channel);
        showUnread(win, unread, updated.badge);
        syncShortcut();
        return updated;
      },
      getUpdates: () => updates.get(),
      checkUpdates: () => updates.check(),
      installUpdate: () => {
        quitting = true;
        updates.install();
      },
      signIn: (provider) => signIn.start(provider),
      openInBrowser: (path) => void shell.openExternal(appUrl(path)),
      keepOnTop(on) {
        keepPictureOnTop = on;
        for (const other of BrowserWindow.getAllWindows()) {
          if (other !== win && other.isAlwaysOnTop() !== on) {
            other.setAlwaysOnTop(on, "floating");
          }
        }
      },
    });

    buildAppMenu({
      openPath,
      checkForUpdates: () => void checkForUpdatesFromMenu(),
      quit,
    });
    tray = createTray({
      show,
      openPath,
      command: send,
      checkForUpdates: () => void checkForUpdatesFromMenu(),
      quit,
    });
    refreshTray();

    reminders = new Reminders(
      ses,
      () => store.get().reminderMinutes,
      openPath,
      (meetingNext) => {
        next = meetingNext;
        refreshTray();
      },
    );
    reminders.start();

    updates.onChange((state) => {
      win?.webContents.send("faceon:updates:state", state);
      if (state.status === "ready" && Notification.isSupported()) {
        const notice = new Notification({
          title: strings.updateReady(APP_NAME, state.version),
          body: strings.updateReadyDetail,
        });
        notice.on("click", () => openPath("/settings/desktop"));
        notice.show();
      }
    });
    if (RELEASES_REPO) void updates.start(preferences().channel);

    win = openWindow();
    if (pendingLink) handleLink(pendingLink);
    pendingLink = undefined;
    app.on("activate", () => void show());
  });
}

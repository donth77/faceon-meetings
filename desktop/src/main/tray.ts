import { join } from "node:path";
import {
  Menu,
  nativeImage,
  Tray,
  type MenuItemConstructorOptions,
} from "electron";

import type { DesktopCommand } from "../../../src/lib/desktop/bridge";
import { APP_NAME } from "./config";
import type { UpcomingMeeting } from "./reminder-schedule";
import { strings } from "./strings";

export type TrayState = {
  inMeeting: boolean;
  muted: boolean;
  /** The mute shortcut in use, shown beside Mute. */
  accelerator: string | null;
  next: UpcomingMeeting | null;
};

/** The tray (Windows) or menu-bar item (macOS): native menus only. */
export function createTray(actions: {
  show(): void;
  openPath(path: string): void;
  command(command: DesktopCommand): void;
  checkForUpdates(): void;
  quit(): void;
}) {
  const mac = process.platform === "darwin";
  const icon = nativeImage.createFromPath(
    join(__dirname, "assets", mac ? "trayTemplate.png" : "tray.png"),
  );
  if (mac) icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  if (!mac) tray.on("click", actions.show);

  const render = (state: TrayState) => {
    const meeting: MenuItemConstructorOptions[] = state.inMeeting
      ? [
          {
            label: state.muted ? strings.unmute : strings.mute,
            ...(state.accelerator
              ? { accelerator: state.accelerator, registerAccelerator: false }
              : {}),
            click: () => actions.command({ type: "toggleMute" }),
          },
          {
            label: strings.leave,
            click: () => actions.command({ type: "leave" }),
          },
        ]
      : [
          {
            label: strings.startMeeting,
            click: () => actions.openPath("/home?start=1"),
          },
          {
            label: strings.joinMeeting,
            click: () => actions.openPath("/home"),
          },
          ...(state.next
            ? [
                {
                  label: strings.joinNext(state.next.title),
                  click: () =>
                    actions.openPath(state.next?.path ?? "/upcoming"),
                },
              ]
            : []),
          {
            label: strings.upcoming,
            click: () => actions.openPath("/upcoming"),
          },
        ];
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: strings.open(APP_NAME), click: actions.show },
        { type: "separator" },
        ...meeting,
        { type: "separator" },
        {
          label: strings.settings,
          click: () => actions.openPath("/settings/desktop"),
        },
        { label: strings.checkForUpdates, click: actions.checkForUpdates },
        { type: "separator" },
        { label: strings.quit(APP_NAME), click: actions.quit },
      ]),
    );
  };
  return { render, destroy: () => tray.destroy() };
}

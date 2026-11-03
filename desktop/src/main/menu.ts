import { Menu, type MenuItemConstructorOptions } from "electron";

import { APP_NAME, IS_DEV } from "./config";
import { strings } from "./strings";

/**
 * The application menu: FaceOn's own on macOS, and the window's menu bar on Windows and
 * Linux (File, Edit, View, Window, Help), always showing.
 */
export function buildAppMenu(actions: {
  openPath(path: string): void;
  checkForUpdates(): void;
  quit(): void;
}) {
  const mac = process.platform === "darwin";
  const settings: MenuItemConstructorOptions = {
    label: strings.settings,
    accelerator: "CommandOrControl+,",
    click: () => actions.openPath("/settings/desktop"),
  };
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: "about", label: strings.about(APP_NAME) },
              {
                label: strings.checkForUpdates,
                click: actions.checkForUpdates,
              },
              { type: "separator" },
              settings,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              {
                label: strings.quit(APP_NAME),
                accelerator: "Command+Q",
                click: actions.quit,
              },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : [
          {
            label: "&File",
            submenu: [
              settings,
              {
                label: strings.checkForUpdates,
                click: actions.checkForUpdates,
              },
              { type: "separator" },
              { label: strings.quit(APP_NAME), click: actions.quit },
            ],
          } satisfies MenuItemConstructorOptions,
        ]),
    { role: "editMenu" },
    {
      role: "viewMenu",
      submenu: [
        { role: "reload" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(IS_DEV
          ? [{ role: "toggleDevTools" } satisfies MenuItemConstructorOptions]
          : []),
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: strings.help, click: () => actions.openPath("/help") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

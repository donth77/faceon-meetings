import { Menu, type MenuItemConstructorOptions } from "electron";

import { APP_NAME, IS_DEV } from "./config";
import { strings, withoutAccessKey } from "./strings";

/**
 * The application menu: FaceOn's own on macOS, and the window's menu bar on Windows and
 * Linux (File, Edit, View, Window, Help), always showing. Every label is in the app's
 * language, standard items included, so it's built again when the language changes.
 */
export function buildAppMenu(actions: {
  openPath(path: string): void;
  checkForUpdates(): void;
  quit(): void;
}) {
  const mac = process.platform === "darwin";
  const menuName = (label: string) => (mac ? withoutAccessKey(label) : label);
  const separator: MenuItemConstructorOptions = { type: "separator" };
  const settings: MenuItemConstructorOptions = {
    label: strings.settings,
    accelerator: "CommandOrControl+,",
    click: () => actions.openPath("/settings/desktop"),
  };
  const template: MenuItemConstructorOptions[] = [
    mac
      ? {
          label: APP_NAME,
          submenu: [
            { role: "about", label: strings.about(APP_NAME) },
            { label: strings.checkForUpdates, click: actions.checkForUpdates },
            separator,
            settings,
            separator,
            { role: "services", label: strings.services },
            separator,
            { role: "hide", label: strings.hide(APP_NAME) },
            { role: "hideOthers", label: strings.hideOthers },
            { role: "unhide", label: strings.showAll },
            separator,
            {
              label: strings.quit(APP_NAME),
              accelerator: "Command+Q",
              click: actions.quit,
            },
          ],
        }
      : {
          label: strings.fileMenu,
          submenu: [
            settings,
            { label: strings.checkForUpdates, click: actions.checkForUpdates },
            separator,
            { label: strings.quit(APP_NAME), click: actions.quit },
          ],
        },
    {
      label: menuName(strings.editMenu),
      submenu: [
        { role: "undo", label: strings.undo },
        { role: "redo", label: strings.redo },
        separator,
        { role: "cut", label: strings.cut },
        { role: "copy", label: strings.copy },
        { role: "paste", label: strings.paste },
        ...(mac
          ? [
              {
                role: "pasteAndMatchStyle",
                label: strings.pasteAndMatchStyle,
              } satisfies MenuItemConstructorOptions,
            ]
          : []),
        { role: "delete", label: strings.delete },
        separator,
        { role: "selectAll", label: strings.selectAll },
      ],
    },
    {
      label: menuName(strings.viewMenu),
      submenu: [
        { role: "reload", label: strings.reload },
        { role: "resetZoom", label: strings.actualSize },
        { role: "zoomIn", label: strings.zoomIn },
        { role: "zoomOut", label: strings.zoomOut },
        separator,
        { role: "togglefullscreen", label: strings.fullScreen },
        ...(IS_DEV
          ? [{ role: "toggleDevTools" } satisfies MenuItemConstructorOptions]
          : []),
      ],
    },
    {
      label: menuName(strings.windowMenu),
      role: "window",
      submenu: [
        { role: "minimize", label: strings.minimize },
        ...(mac
          ? ([
              { role: "zoom", label: strings.zoom },
              separator,
              { role: "front", label: strings.bringAllToFront },
            ] satisfies MenuItemConstructorOptions[])
          : ([
              { role: "close", label: strings.close },
            ] satisfies MenuItemConstructorOptions[])),
      ],
    },
    {
      label: menuName(strings.helpMenu),
      role: "help",
      submenu: [
        { label: strings.help, click: () => actions.openPath("/help") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

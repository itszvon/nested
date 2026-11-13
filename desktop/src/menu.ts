import type { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { app, Menu, shell } from "electron";
import { ORIGIN } from "./env";
import { FILE_MENU, HELP_MENU, VIEW_MENU, type MenuSpecItem } from "./menu-spec";

/**
 * Application menu.
 *
 * Commands that already exist as keyboard shortcuts are delivered as synthetic
 * key events, so the renderer keeps one implementation of save, palette and
 * find instead of gaining an IPC path that could drift from the shortcut.
 */

function itemFromSpec(
  item: MenuSpecItem,
  send: (key: NonNullable<MenuSpecItem["key"]>) => void,
  open: (path: string) => void,
): MenuItemConstructorOptions {
  if (item.role) {
    return { label: item.label, accelerator: item.accelerator, role: item.role };
  }
  if (item.url) {
    return { label: item.label, click: () => open(item.url as string) };
  }
  return {
    label: item.label,
    accelerator: item.accelerator,
    click: () => {
      if (item.key) send(item.key);
    },
  };
}

export function menuTemplate(
  send: (key: NonNullable<MenuSpecItem["key"]>) => void,
  open: (path: string) => void,
  openFile?: () => void,
): MenuItemConstructorOptions[] {
  const fileItems = FILE_MENU.map((item) => itemFromSpec(item, send, open));
  if (openFile) {
    fileItems.push({ type: "separator" });
    fileItems.push({ label: "Open File…", accelerator: "CmdOrCtrl+O", click: openFile });
  }

  return [
    { label: "File", submenu: fileItems },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        ...VIEW_MENU.map((item) => itemFromSpec(item, send, open)),
        ...(app.isPackaged
          ? []
          : ([{ type: "separator" }, { role: "toggleDevTools" }] as MenuItemConstructorOptions[])),
      ],
    },
    { label: "Help", submenu: HELP_MENU.map((item) => itemFromSpec(item, send, open)) },
  ];
}

export function buildMenu(window: BrowserWindow, openFile?: () => void): Menu {
  const menu = Menu.buildFromTemplate(
    menuTemplate(
      ({ keyCode, modifiers }) => {
        window.webContents.sendInputEvent({ type: "keyDown", keyCode, modifiers });
        window.webContents.sendInputEvent({ type: "keyUp", keyCode, modifiers });
      },
      (path) => {
        void shell.openExternal(`${ORIGIN}${path}`);
      },
      openFile,
    ),
  );

  Menu.setApplicationMenu(menu);
  return menu;
}

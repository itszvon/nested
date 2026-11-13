/**
 * Menu structure, kept free of Electron imports so it can be tested in plain
 * Node. `menu.ts` turns this into real menu items.
 */

export type MenuKey = { keyCode: string; modifiers: Array<"control" | "shift" | "alt"> };

export type MenuSpecItem = {
  label: string;
  accelerator?: string;
  /** Sent to the focused window as a real key press. */
  key?: MenuKey;
  role?:
    | "undo"
    | "redo"
    | "cut"
    | "copy"
    | "paste"
    | "selectAll"
    | "reload"
    | "resetZoom"
    | "zoomIn"
    | "zoomOut"
    | "toggleDevTools";
  url?: string;
};

export const FILE_MENU: MenuSpecItem[] = [
  { label: "New File", accelerator: "CmdOrCtrl+N", key: { keyCode: "N", modifiers: ["control"] } },
  { label: "Save", accelerator: "CmdOrCtrl+S", key: { keyCode: "S", modifiers: ["control"] } },
  { label: "Command Palette", accelerator: "CmdOrCtrl+P", key: { keyCode: "P", modifiers: ["control"] } },
];

export const VIEW_MENU: MenuSpecItem[] = [
  { label: "Reload", accelerator: "CmdOrCtrl+R", role: "reload" },
  { label: "Actual Size", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
  { label: "Zoom In", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
  { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
];

export const HELP_MENU: MenuSpecItem[] = [
  { label: "Privacy", url: "/privacy" },
  { label: "Security policy", url: "/security" },
  { label: "Terms", url: "/terms" },
];

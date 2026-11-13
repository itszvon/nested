import { contextBridge, ipcRenderer } from "electron";

/**
 * The only surface page JavaScript gets. No paths, no filesystem, no Node.
 * File dialogs and deep-link routing are requests the main process fulfils.
 */
contextBridge.exposeInMainWorld("nested", {
  getInfo: (): Promise<{ platform: string; version: string; desktop: boolean }> =>
    ipcRenderer.invoke("nested:info"),
  /** Returns null when the user cancels the dialog. */
  openFile: (): Promise<
    | { ok: true; file: { name: string; content: string } }
    | { ok: false; error: string }
    | null
  > => ipcRenderer.invoke("file:open"),
  saveFile: (
    name: string,
    content: string,
  ): Promise<{ ok: true; path: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke("file:save", { name, content }),
  onDeepLink: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: unknown, url: string) => callback(url);
    ipcRenderer.on("nested:deep-link", listener);
    return () => {
      ipcRenderer.off("nested:deep-link", listener);
    };
  },
});

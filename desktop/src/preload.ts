import { contextBridge, ipcRenderer } from "electron";

/**
 * The only surface page JavaScript gets. No paths, no filesystem, no Node.
 * File dialogs and deep-link routing are requests the main process fulfils.
 */
contextBridge.exposeInMainWorld("nested", {
  getInfo: (): Promise<{ platform: string; version: string; desktop: boolean }> =>
    ipcRenderer.invoke("nested:info"),
  onDeepLink: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: unknown, url: string) => callback(url);
    ipcRenderer.on("nested:deep-link", listener);
    return () => {
      ipcRenderer.off("nested:deep-link", listener);
    };
  },
});

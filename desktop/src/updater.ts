import type { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { dialog } from "electron";
import type { DirtyGuard } from "./update-guard";

/**
 * Auto-update wiring.
 *
 * Downloads happen in the background; installing waits for a clean editor.
 * `electron-updater` never downgrades, so a bad release is replaced by
 * publishing a higher version (see docs/INCIDENT.md).
 */

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initUpdater(window: BrowserWindow, guard: DirtyGuard): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    if (!guard.canRestart()) {
      void dialog.showMessageBox(window, {
        type: "info",
        title: "Update ready",
        message: `Nested ${info.version} is ready to install.`,
        detail: "Save or discard the file you are editing, then restart to finish.",
        buttons: ["Later"],
      });
      return;
    }

    void dialog
      .showMessageBox(window, {
        type: "info",
        title: "Update ready",
        message: `Nested ${info.version} is ready to install.`,
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0 && guard.canRestart()) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", () => {
    // Update failures must never interrupt the editor; the next check retries.
  });

  void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

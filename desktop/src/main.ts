import { app, BrowserWindow, ipcMain, shell } from "electron";
import { IS_SMOKE, ORIGIN, preloadPath, token } from "./env";

/**
 * One window, one server, one instance.
 *
 * The renderer is the same Next.js app the web deployment serves, loaded from
 * a loopback origin. Everything privileged stays in this process.
 */

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    show: !IS_SMOKE,
    title: "Nested",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    // Nothing in the product opens a second window; links leave to the browser.
    if (url.startsWith(ORIGIN)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  return window;
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle("nested:info", () => ({
    platform: process.platform,
    version: app.getVersion(),
    desktop: true,
  }));

  app.whenReady().then(() => {
    mainWindow = createWindow();

    if (IS_SMOKE) {
      // The server is not part of this task; report the shell and exit.
      process.stdout.write(JSON.stringify({ windows: BrowserWindow.getAllWindows().length, tokenLength: token().length }) + "\n");
      app.exit(0);
      return;
    }

    void mainWindow.loadURL(`${ORIGIN}/login`);
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

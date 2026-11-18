import type { ChildProcess } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { release } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, clipboard, dialog, ipcMain, screen, shell } from "electron";
import { validateExport, validateImport, type ImportResult } from "./files";
import { isOAuthNavigation, openExternalAuth } from "./auth";
import { buildMenu } from "./menu";
import { HOST, IS_SMOKE, ORIGIN, PORT, SMOKE, preloadPath, standaloneEntry, token } from "./env";
import { findDeepLink, parseDeepLink } from "./protocol";
import { createDirtyGuard } from "./update-guard";
import { initUpdater } from "./updater";
import { startServer, stopServer, waitForServer } from "./server";
import { clampBounds, MIN_HEIGHT, MIN_WIDTH } from "./window-state";

/**
 * One window, one server, one instance.
 *
 * The renderer is the same Next.js app the web deployment serves, loaded from
 * a loopback origin. Everything privileged stays in this process.
 */

const START_TIMEOUT_MS = 20_000;

const dirtyGuard = createDirtyGuard();

/**
 * Main-process failures have nowhere to go: a crash in this process takes the
 * window with it. One rotated file in the OS log directory is enough to
 * diagnose a report without asking the user to reproduce it.
 */
function logCrash(kind: string, error: unknown): void {
  try {
    const dir = app.getPath("logs");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "main.log");
    if (existsSync(file) && statSync(file).size > 1024 * 1024) {
      renameSync(file, join(dir, "main.1.log"));
    }
    const text = error instanceof Error ? error.stack ?? error.message : String(error);
    appendFileSync(file, `[${new Date().toISOString()}] ${kind}: ${text}\n`);
  } catch {
    // Nothing safe left to do if logging itself fails.
  }
}

process.on("uncaughtException", (error) => logCrash("uncaughtException", error));
process.on("unhandledRejection", (reason) => logCrash("unhandledRejection", reason));

function showAbout(): void {
  const detail = [
    `Version ${app.getVersion()}`,
    `Electron ${process.versions.electron}`,
    `Chromium ${process.versions.chrome}`,
    `Node ${process.versions.node}`,
    `OS Windows ${release()} (${process.arch})`,
  ].join("\n");

  void dialog
    .showMessageBox({
      type: "info",
      title: "About Nested",
      message: "Nested",
      detail,
      buttons: ["Copy details", "Close"],
      defaultId: 1,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) clipboard.writeText(`Nested\n${detail}`);
    });
}

let mainWindow: BrowserWindow | null = null;
let server: ChildProcess | null = null;
let quitting = false;
let restarts = 0;

function windowStateFile(): string {
  return join(app.getPath("userData"), "window-state.json");
}

function readWindowState(): unknown {
  try {
    return JSON.parse(readFileSync(windowStateFile(), "utf8"));
  } catch {
    return null;
  }
}

/** Temp file then rename: a crash mid-write must not leave invalid JSON. */
function writeWindowState(bounds: unknown): void {
  try {
    const file = windowStateFile();
    writeFileSync(`${file}.tmp`, JSON.stringify(bounds));
    renameSync(`${file}.tmp`, file);
  } catch {
    // Geometry is a convenience; never fail a close over it.
  }
}

function createWindow(): BrowserWindow {
  const bounds = clampBounds(
    readWindowState(),
    screen.getAllDisplays().map((display) => display.workArea),
    { width: 1280, height: 820 },
  );

  const window = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
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
    if (isOAuthNavigation(url)) {
      openExternalAuth(url);
      return { action: "deny" };
    }
    // Nothing in the product opens a second window; links leave to the browser.
    if (url.startsWith(ORIGIN)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // A full navigation to Google or Supabase's authorize endpoint is sign-in,
  // and Google rejects embedded webviews outright.
  window.webContents.on("will-navigate", (event, url) => {
    if (!isOAuthNavigation(url)) return;
    event.preventDefault();
    openExternalAuth(url);
  });

  window.on("close", () => {
    if (window.isMinimized() || window.isFullScreen()) return;
    writeWindowState(window.getBounds());
  });

  return window;
}

async function launchServer(): Promise<boolean> {
  server = startServer({
    entry: standaloneEntry(),
    port: PORT,
    host: HOST,
    token: token(),
    logDir: app.getPath("logs"),
  });

  server.once("exit", (code) => {
    server = null;
    if (quitting || IS_SMOKE) return;

    // A dead server behind a live window is worse than a restart: try once,
    // then say so plainly instead of leaving a blank frame.
    if (restarts < 1) {
      restarts += 1;
      void launchServer().then((ok) => {
        if (!ok) failToStart("The local server stopped and could not be restarted.");
      });
      return;
    }

    failToStart(`The local server stopped unexpectedly (exit code ${code ?? "unknown"}).`);
  });

  return waitForServer(ORIGIN, START_TIMEOUT_MS, token());
}

function failToStart(detail: string) {
  dialog.showErrorBox(
    "Nested could not start",
    `${detail}\n\nPort ${PORT} must be free, and the app needs to be able to run its local server.\n`,
  );
  app.exit(1);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  function routeDeepLink(raw: string | null): void {
    const link = raw ? parseDeepLink(raw) : null;
    if (!link || !mainWindow) return;
    void mainWindow.loadURL(`${ORIGIN}/app?f=${encodeURIComponent(link.id)}`);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  app.on("second-instance", (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    routeDeepLink(findDeepLink(commandLine));
  });

  // macOS delivers links through this event instead of argv.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    routeDeepLink(url);
  });

  // The renderer reports unsaved state; only it knows whether the buffer differs.
  ipcMain.handle("nested:dirty", (_event, value: unknown) => {
    dirtyGuard.setDirty(value === true);
    return { ok: true };
  });

  ipcMain.handle("nested:info", () => ({
    platform: process.platform,
    version: app.getVersion(),
    desktop: true,
  }));

  // The renderer never sees a path: it asks for a file, the main process
  // resolves, validates and returns text. The menu uses the same function.
  async function pickFile(): Promise<ImportResult | null> {
    if (!mainWindow) return { ok: false, error: "No window." };

    const picked = await dialog.showOpenDialog(mainWindow, {
      title: "Open a file",
      properties: ["openFile"],
      filters: [
        {
          name: "Text and code",
          extensions: [
            "txt", "md", "py", "js", "jsx", "ts", "tsx", "json", "yaml", "yml",
            "html", "css", "sql", "java", "c", "h", "cpp", "hpp", "go", "rs", "sh",
          ],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });

    if (picked.canceled || !picked.filePaths[0]) return null;

    try {
      return validateImport(picked.filePaths[0], await readFile(picked.filePaths[0]));
    } catch {
      return { ok: false, error: "That file could not be read." };
    }
  }

  ipcMain.handle("file:open", pickFile);

  ipcMain.handle("file:save", async (_event, payload: unknown) => {
    const input = payload as { name?: unknown; content?: unknown } | null;
    const checked = validateExport(
      typeof input?.name === "string" ? input.name : "untitled.txt",
      input?.content,
    );
    if (!checked.ok) return checked;
    if (!mainWindow) return { ok: false, error: "No window." };

    const target = await dialog.showSaveDialog(mainWindow, {
      title: "Save file",
      defaultPath: checked.name,
    });
    if (target.canceled || !target.filePath) return { ok: false, error: "Save cancelled." };

    try {
      await writeFile(target.filePath, checked.content, "utf8");
      return { ok: true, path: target.filePath };
    } catch {
      return { ok: false, error: "That file could not be written." };
    }
  });

  app.whenReady().then(async () => {
    if (SMOKE === "full") {
      // Proves the packaged boot path: server first, then teardown.
      const ready = await launchServer();

      // The whole point of the guard: a request without the handshake header
      // is refused even though the server is listening.
      const probe = ready ? await fetch(`${ORIGIN}/app`, { redirect: "manual" }) : null;
      const guarded = probe?.status === 403;

      // The other half: the same request *with* the header must be served.
      // Without this check the guard could lock the app out entirely (it did).
      const authed = ready
        ? await fetch(`${ORIGIN}/app`, {
            redirect: "manual",
            headers: { "x-nested-desktop": token() },
          })
        : null;
      const served = authed !== null && authed.status !== 403;

      process.stdout.write(
        JSON.stringify({
          server: ready,
          guarded,
          served,
          authedStatus: authed?.status ?? null,
          tokenLength: token().length,
        }) + "\n",
      );
      quitting = true;
      if (server) await stopServer(server);
      app.exit(ready ? 0 : 1);
      return;
    }

    if (IS_SMOKE) {
      // Shell-only check: no server, no window contents.
      mainWindow = createWindow();
      process.stdout.write(
        JSON.stringify({ windows: BrowserWindow.getAllWindows().length, tokenLength: token().length }) + "\n",
      );
      app.exit(0);
      return;
    }

    const ready = await launchServer();
    if (!ready) {
      failToStart(`Port ${PORT} is already in use, or the server did not answer in ${START_TIMEOUT_MS / 1000}s.`);
      return;
    }

    mainWindow = createWindow();
    buildMenu(
      mainWindow,
      () => {
        void pickFile().then((result) => {
          if (result?.ok) mainWindow?.webContents.send("nested:file-opened", result.file);
        });
      },
      showAbout,
    );
    // The server refuses loopback requests without this header, and only the
    // main process knows the token. Without this hook every page returns 403.
    const desktopToken = token();
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.url.startsWith(ORIGIN)) {
        details.requestHeaders["x-nested-desktop"] = desktopToken;
      }
      callback({ requestHeaders: details.requestHeaders });
    });

    void mainWindow.loadURL(`${ORIGIN}/login`);

    // A link that launched the app arrives on the first instance's argv.
    if (app.isPackaged) app.setAsDefaultProtocolClient("nested");
    const startupLink = findDeepLink(process.argv);
    if (startupLink) routeDeepLink(startupLink);

    if (app.isPackaged) initUpdater(mainWindow, dirtyGuard);
  });

  app.on("before-quit", () => {
    quitting = true;
    if (server) void stopServer(server);
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}

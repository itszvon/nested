# Nested Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Nested as a signed Windows desktop application that runs the same Next.js server locally, alongside the unchanged Vercel web deployment.

**Architecture:** One codebase, two build targets. The desktop app is Electron: the main process spawns the existing Next.js standalone server on `127.0.0.1:43110` using Electron's bundled Node (`ELECTRON_RUN_AS_NODE=1`), then loads it in a `BrowserWindow`. There is no second backend and no second API: it is the same stateless server that runs on Vercel, talking to the same Supabase project. All desktop-only code lives under `desktop/`; `src/` changes are limited to a standalone build flag, a loopback handshake check, and a runtime origin override.

**Tech Stack:** Electron (main + preload, TypeScript), Next.js 16.4.3 standalone output, electron-builder (NSIS + portable), electron-updater, Playwright `_electron` for end-to-end tests.

**Spec:** `docs/SPEC.md` and `docs/PRODUCT.md` remain the product spec. This document is the packaging and runtime spec; it does not change product behaviour.

---

## 0. Decisions locked before any code

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Shell | **Electron** | The app's value sits in server components, server actions, cookie sessions and the proxy. Electron bundles Node, so that code runs unmodified. Tauri would need a Node sidecar plus IPC plumbing to reach the same place, and its Windows WebView2 does not give a smaller or faster result here. |
| D2 | Repo layout | Keep root as the web app; add `desktop/` | No monorepo migration, no path churn, Vercel build untouched. |
| D3 | Local server | Next `output: "standalone"`, spawned as a child of Electron's Node | Same code path as production; no `next start` dev dependency in the package. |
| D4 | Network posture v1 | **Online-only** | An offline store is a separate product decision (see Phase E). Desktop v1 requires a connection exactly like the web app. |
| D5 | Auth | System-browser OAuth with loopback redirect | Google blocks embedded webviews. RFC 8252 loopback is the supported native-app pattern and reuses `/auth/callback`. |
| D6 | Distribution | GitHub Releases + `electron-updater` | Free, signed, and already where the repo lives. |
| D7 | Platforms | **Windows x64 first**, macOS/Linux after v1 ships | The operator is on Windows; NSIS + portable covers it. |
| D8 | Secrets | No service-role key, no `CRON_SECRET` in the desktop build | The desktop client is public software. It gets the publishable key only. |

### Why not "just wrap the website"

A plain browser window pointed at `nestedforyou.vercel.app` is not a desktop app: it loses offline file integration, has no auto-update, cannot open local files, and still needs a browser profile for OAuth. The loopback-server design keeps full parity today and leaves room for the native features below without a rewrite.

---

## 1. Architecture

```
┌─────────────────────────── Electron main ───────────────────────────┐
│  single-instance lock                                               │
│  spawns: ELECTRON_RUN_AS_NODE=1 .next/standalone/server.js          │
│            env: PORT=43110, HOSTNAME=127.0.0.1,                     │
│                 NEXT_PUBLIC_SITE_URL=http://127.0.0.1:43110,        │
│                 NESTED_DESKTOP_TOKEN=<random 32 bytes, per launch>  │
│  waits for GET /api/health == 200 (20 s cap)                        │
│  BrowserWindow -> http://127.0.0.1:43110/login                      │
│  webRequest.onBeforeSendHeaders adds x-nested-desktop: <token>      │
└─────────────────────────────────────────────────────────────────────┘
                                  │  loopback HTTP only
                                  ▼
┌──────────────────── same code as Vercel ────────────────────────────┐
│  proxy.ts: host check + token check when NESTED_DESKTOP_TOKEN set   │
│  server actions -> Supabase (publishable key + user cookie)         │
│  /auth/callback <- system browser redirect (127.0.0.1:43110)        │
└─────────────────────────────────────────────────────────────────────┘
```

**Request trust.** A loopback port is reachable by every local process. Two controls, both in `src/proxy.ts`, close that:

1. `Host` must be exactly `127.0.0.1:43110` (blocks DNS rebinding, which beats an origin check but cannot forge `Host`).
2. `x-nested-desktop` must equal `NESTED_DESKTOP_TOKEN` (blocks a local process or a stray page from using the API with the user's cookie jar).

The token never reaches page JavaScript: only the main process adds it, and client-side calls go straight to Supabase, not the local server.

**Upgrade path.** The standalone bundle is versioned with the app; `electron-updater` swaps the whole directory on restart, so a stale server and a new renderer can never meet.

---

## 2. Global constraints

- Node ≥ 20 in dev; the packaged runtime is Electron's Node. Pin the exact Electron version in `desktop/package.json` and do not float it.
- `output: "standalone"` must be inert on Vercel (it is; Vercel ignores the field) - but the web build must be re-run in CI after the change.
- No new runtime dependency in `package.json` root dependencies. Desktop deps live in `desktop/package.json`.
- No service-role key, no `CRON_SECRET`, no Sentry server DSN inside the desktop package.
- All desktop-only code under `desktop/`. `src/` changes limited to: `next.config.ts` (standalone), `src/proxy.ts` (loopback guard), `src/lib/site.ts` (origin already prefers `NEXT_PUBLIC_SITE_URL`), `src/app/app/runner.tsx` (optional local Pyodide path, Phase E).
- UI copy and design rules from `docs/DESIGN.md` apply unchanged: dark only, no em dashes in interface copy, mono uppercase labels.
- Every task ends with `npm run typecheck && npm test` green for the root app, and `npm --prefix desktop run typecheck` green for the shell.
- Commits are conventional (`feat(desktop): ...`), one per task.

---

## 3. Review focus

These are the inputs the spec does not discuss and that will bite a real user first. Each one gets a test in the task that owns the code.

1. **Port 43110 already in use** (another instance, a stale crash) - expect a clear retry/failure dialog, never a blank window.
2. **Server child dies after the window opens** - expect a "reconnecting" state and automatic respawn, not a dead frame.
3. **Second launch while the app is running** - expect the existing window to focus, not a second server on a second port.
4. **Launch with no network** - expect the login/app shell to render and fail loudly on save, matching the web behaviour.
5. **Login cancelled or the browser is closed mid-OAuth** - expect the app to return to the sign-in screen with a message, not a spinner forever.
6. **A local process curling `127.0.0.1:43110/app`** - expect 403 without the handshake header.
7. **Update applied while a file is dirty** - expect the app to refuse to restart until the draft is saved or discarded.

---

## 4. File structure

**Create**

| Path | Responsibility |
|---|---|
| `desktop/package.json` | Electron deps, scripts, `main` entry |
| `desktop/tsconfig.json` | Separate TS project for main/preload (`module: nodenext`) |
| `desktop/src/main.ts` | App lifecycle, single-instance lock, window creation |
| `desktop/src/server.ts` | Spawn/kill the Next standalone server, health wait, token generation |
| `desktop/src/preload.ts` | `contextBridge` surface: `platform`, `version`, `openFile`, `saveFile`, `onDeepLink` |
| `desktop/src/menu.ts` | Application menu, shortcuts that match the web palette |
| `desktop/src/protocol.ts` | `nested://` deep-link parsing and dispatch |
| `desktop/src/updater.ts` | `electron-updater` wiring + dirty-state guard |
| `desktop/src/env.ts` | Fixed port, origin, token, packaged-vs-dev paths |
| `desktop/electron-builder.yml` | Windows NSIS + portable, file include list, publish config |
| `desktop/resources/icon.ico` | Installer/window icon derived from `src/app/icon.svg` |
| `desktop/tests/smoke.spec.ts` | Playwright `_electron` launch + gate assertions |
| `desktop/README.md` | Build, sign, release steps |

**Modify**

| Path | Change |
|---|---|
| `next.config.ts` | Add `output: "standalone"` behind `process.env.NEXT_DESKTOP_BUILD === "1"` |
| `src/proxy.ts` | Loopback guard (host + token) when `NESTED_DESKTOP_TOKEN` is set |
| `package.json` | `build:desktop` script that sets the flag and runs `next build` |
| `.github/workflows/` | New `desktop-release.yml` |
| `docs/INCIDENT.md` | Desktop crash/update section |
| `docs/ADMIN.md` | Note that desktop users are the same accounts |

---

## 5. Tasks

### Phase A - Build plumbing

---

#### Task 1: Emit a standalone server for desktop builds only

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json`
- Test: `desktop/tests/standalone-output.spec.ts` (Node test, no browser)

**Interfaces:**
- Produces: `NEXT_DESKTOP_BUILD=1 npm run build:desktop` writes `.next/standalone/server.js`.
- Produces: `nextConfig.output` is `"standalone"` only when `process.env.NEXT_DESKTOP_BUILD === "1"`.

- [ ] **Step 1: Write the failing test**

```ts
// desktop/tests/standalone-output.spec.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../../next.config";

test("standalone output is opt-in", () => {
  delete process.env.NEXT_DESKTOP_BUILD;
  assert.equal(nextConfig.output, undefined);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test --experimental-strip-types desktop/tests/standalone-output.spec.ts`
Expected: FAIL - `output` is undefined already, so the real assertion to add is the enabled branch; adjust the test to assert `output === "standalone"` with the env var set, and watch that fail first.

- [ ] **Step 3: Implement**

In `next.config.ts`, add `output: process.env.NEXT_DESKTOP_BUILD === "1" ? "standalone" : undefined` to the config object. In root `package.json`, add:

```json
"build:desktop": "NEXT_DESKTOP_BUILD=1 next build"
```

Use `cross-env` only if the CI runner is not POSIX; on Windows PowerShell set it via `$env:` in the release workflow instead.

- [ ] **Step 4: Verify**

Run: `npm run build && npm run build:desktop`
Expected: both succeed; `.next/standalone/server.js` exists only after the second.

- [ ] **Step 5: Commit** - `feat(desktop): opt-in standalone server output`

---

#### Task 2: Scaffold the Electron shell

**Files:**
- Create: `desktop/package.json`, `desktop/tsconfig.json`, `desktop/src/main.ts`, `desktop/src/env.ts`, `desktop/src/preload.ts`
- Test: `desktop/tests/smoke.spec.ts`

**Interfaces:**
- `env.ts` produces `const PORT = 43110`, `const ORIGIN = \`http://127.0.0.1:${PORT}\``, `function token(): string` (32 random bytes hex, memoised per launch), `function standaloneEntry(appPath: string): string`.
- `preload.ts` produces `window.nested = { platform: NodeJS.Platform, version: string, onDeepLink(cb: (url: string) => void): () => void }`.

- [ ] **Step 1: Write the failing smoke test**

```ts
// desktop/tests/smoke.spec.ts
import { test, expect, _electron as electron } from "@playwright/test";

test("window opens on the login page", async () => {
  const app = await electron.launch({ args: ["desktop/dist/main.js"] });
  const window = await app.firstWindow();
  await expect(window).toHaveURL(/\/login/);
  expect(await window.title()).toBe("Nested");
  await app.close();
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx playwright test desktop/tests/smoke.spec.ts`
Expected: FAIL - cannot find `desktop/dist/main.js`.

- [ ] **Step 3: Implement the shell**

`desktop/package.json` with `"main": "dist/main.js"`, scripts `build` (`tsc -p tsconfig.json`), `start`, `test`. `main.ts` uses `app.requestSingleInstanceLock()`, `new BrowserWindow({ width: 1280, height: 820, webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true } })`, and loads `ORIGIN + "/login"` for now. Do not call `enableRemoteModule`; it does not exist in modern Electron.

- [ ] **Step 4: Verify**

Run: `npm --prefix desktop run build && npx playwright test desktop/tests/smoke.spec.ts`
Expected: PASS, window opens (it will show a connection error until Task 3).

- [ ] **Step 5: Commit** - `feat(desktop): electron shell with single-instance lock`

---

### Phase B - Server lifecycle and auth

---

#### Task 3: Spawn the Next server and wait for health

**Files:**
- Create: `desktop/src/server.ts`
- Modify: `desktop/src/main.ts`
- Test: `desktop/tests/server-lifecycle.spec.ts`

**Interfaces:**
- `startServer(opts: { entry: string; port: number; token: string }): Promise<ChildProcess>`
- `waitForHealth(origin: string, timeoutMs: number): Promise<boolean>` - polls `/api/health` every 250 ms.
- `stopServer(child: ChildProcess, timeoutMs = 5000): Promise<void>` - `SIGTERM`, then `SIGKILL`.

- [ ] **Step 1: Write the failing test**

```ts
test("health wait fails cleanly when nothing is listening", async () => {
  const ok = await waitForHealth("http://127.0.0.1:49999", 1500);
  assert.equal(ok, false);
});

test("server child is reused and eventually answers", async () => {
  const child = await startServer({ entry: STANDALONE, port: 43110, token: "t" });
  assert.equal(await waitForHealth("http://127.0.0.1:43110", 20000), true);
  await stopServer(child);
});
```

- [ ] **Step 2: Run and confirm failure** (`Cannot find module '../src/server'`)

- [ ] **Step 3: Implement**

Spawn with:

```ts
spawn(process.execPath, [entry], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port), HOSTNAME: "127.0.0.1",
         NEXT_PUBLIC_SITE_URL: origin, NESTED_DESKTOP_TOKEN: token, NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
```

Pipe stdout/stderr into a rotating log at `app.getPath("logs")/server.log` (cap 1 MB, one rotation). Never log the token.

- [ ] **Step 4: Verify** - run the lifecycle spec; both assertions pass in under 25 s.

- [ ] **Step 5: Commit** - `feat(desktop): managed Next server lifecycle`

---

#### Task 4: Loopback handshake guard

**Files:**
- Modify: `src/proxy.ts`
- Test: `src/proxy.test.ts` (new, pure helper extracted to `src/lib/desktop-guard.ts`)

**Interfaces:**
- `src/lib/desktop-guard.ts` produces `function desktopGuard(headers: Headers, expectedToken: string | undefined): "ok" | "forbidden"`.
- Returns `"ok"` when `expectedToken` is undefined (web deployment).

- [ ] **Step 1: Write the failing tests**

```ts
test("web mode always passes", () => {
  assert.equal(desktopGuard(new Headers(), undefined), "ok");
});
test("missing token is forbidden", () => {
  assert.equal(desktopGuard(new Headers({ host: "127.0.0.1:43110" }), "abc"), "forbidden");
});
test("wrong host is forbidden even with the token", () => {
  assert.equal(desktopGuard(new Headers({ host: "evil.test", "x-nested-desktop": "abc" }), "abc"), "forbidden");
});
test("correct host and token pass", () => {
  assert.equal(desktopGuard(new Headers({ host: "127.0.0.1:43110", "x-nested-desktop": "abc" }), "abc"), "ok");
});
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement** - constant-time compare via `crypto.timingSafeEqual` on equal-length buffers. In `proxy.ts`, call it first and return `new NextResponse("Forbidden", { status: 403 })` before any session work.

- [ ] **Step 4: Verify** - `npm test`, then in a desktop build: `curl -i http://127.0.0.1:43110/app` returns 403, while the app window loads.

- [ ] **Step 5: Commit** - `feat(desktop): loopback handshake guard`

---

#### Task 5: System-browser OAuth with loopback redirect

**Files:**
- Modify: `desktop/src/main.ts` (open external browser for `/login` flows)
- Create: `desktop/src/auth.ts`
- Modify: `docs/OAUTH-DOMAIN.md` (new redirect URI)
- Test: `desktop/tests/auth-redirect.spec.ts`

**Interfaces:**
- `function isOAuthNavigation(url: string): boolean` - true for `accounts.google.com` and `<supabase>/auth/v1/authorize`.
- `function openExternalAuth(url: string): void` - `shell.openExternal`.

- [ ] **Step 1: Write the failing test**

```ts
test("google authorize URLs are treated as external", () => {
  assert.equal(isOAuthNavigation("https://accounts.google.com/o/oauth2/v2/auth?x=1"), true);
  assert.equal(isOAuthNavigation("http://127.0.0.1:43110/app"), false);
});
```

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement**

In `webContents.setWindowOpenHandler` and a `will-navigate` listener, route any `isOAuthNavigation` URL through `shell.openExternal` and return `{ action: "deny" }`. Google requires this; embedded webviews are rejected with `disallowed_useragent`.

Then register two redirect URIs:
- Google Cloud console: `http://127.0.0.1:43110/auth/callback`
- Supabase Auth → URL Configuration → Redirect URLs: `http://127.0.0.1:43110/**`

Because `requestOrigin()` prefers `NEXT_PUBLIC_SITE_URL`, and the desktop server sets it to the loopback origin, the existing `/auth/callback` handler needs no change.

- [ ] **Step 4: Verify** - `npm --prefix desktop run build`, launch, click Sign in with Google: the system browser opens, the chooser names "Nested", and the window lands on `/app` with a session.

- [ ] **Step 5: Commit** - `feat(desktop): loopback oauth via system browser`

---

### Phase C - Native integration

---

#### Task 6: Window chrome, menu and shortcuts

**Files:**
- Create: `desktop/src/menu.ts`
- Modify: `desktop/src/main.ts`

**Interfaces:**
- `buildMenu(win: BrowserWindow): Menu` with items: File → New File / Save / Export Project, Edit → standard roles, View → Reload / Toggle DevTools (dev only), Help → Privacy / Security pages.
- `Save` sends `webContents.send("nested:command", "save")`; the renderer already owns the save path, so no new IPC surface.

- [ ] **Step 1: Write the failing test** - assert `Menu.getApplicationMenu()?.items.map(i => i.label)` contains `File`, `Edit`, `View`.
- [ ] **Step 2: Confirm failure.**
- [ ] **Step 3: Implement** - remove the default menu, register accelerators matching the web palette (`Ctrl+S`, `Ctrl+P`, `Ctrl+K`).
- [ ] **Step 4: Verify** - launch, press `Ctrl+P`: the palette opens.
- [ ] **Step 5: Commit** - `feat(desktop): application menu and shortcuts`

---

#### Task 7: Import and export real files

**Files:**
- Modify: `desktop/src/preload.ts`
- Modify: `desktop/src/main.ts` (`ipcMain.handle` for `file:open`, `file:save`)
- Modify: `src/app/app/file-pane.tsx` (call `window.nested.openFile()` when present, else `<input type=file>`)
- Test: `desktop/tests/file-io.spec.ts`

**Interfaces:**
- `window.nested.openFile(): Promise<{ name: string; content: string } | null>` - `dialog.showOpenDialog`, UTF-8 read, 2 MB cap matching the DB `file_too_large` limit.
- `window.nested.saveFile(name: string, content: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test** - stub `dialog.showOpenDialog` to return a temp fixture and assert the returned shape and the 2 MB rejection.
- [ ] **Step 2: Confirm failure.**
- [ ] **Step 3: Implement** - feature-detect in the renderer so the web build keeps its current `<input type=file>` path. Never accept a path from the renderer; only the main process resolves paths.
- [ ] **Step 4: Verify** - drag a `.py` onto the window creates a code file with language `python`; Export writes a `.zip` identical to the web export.
- [ ] **Step 5: Commit** - `feat(desktop): native file open and save`

---

#### Task 8: `nested://` deep links

**Files:**
- Create: `desktop/src/protocol.ts`
- Modify: `desktop/src/main.ts`, `desktop/electron-builder.yml` (protocol registration)

**Interfaces:**
- `parseDeepLink(url: string): { kind: "file"; id: string } | null` for `nested://file/<uuid>`.
- `focusAndRoute(win, target)` navigates to `/app?f=<id>`.

- [ ] **Step 1: Write the failing test** - `parseDeepLink("nested://file/abc")` returns the id; `nested://evil/../..` returns null.
- [ ] **Step 2: Confirm failure.**
- [ ] **Step 3: Implement** - validate the id as a UUID; call `app.setAsDefaultProtocolClient("nested")` on Windows when packaged; handle `second-instance` argv.
- [ ] **Step 4: Verify** - `start nested://file/<id>` in a terminal focuses the app on that file.
- [ ] **Step 5: Commit** - `feat(desktop): deep links`

---

#### Task 9: Auto-update with a dirty-file guard

**Files:**
- Create: `desktop/src/updater.ts`
- Modify: `desktop/src/main.ts`

**Interfaces:**
- `initUpdater(win: BrowserWindow): void` - `autoUpdater.checkForUpdatesAndNotify()` on launch and every 6 h.
- `setDirty(value: boolean): void` - renderer reports unsaved state via `webContents.send("nested:dirty", true)`.
- `canRestart(): boolean` - false while dirty.

- [ ] **Step 1: Write the failing test** - `canRestart()` is false after `setDirty(true)` and true after `setDirty(false)`.
- [ ] **Step 2: Confirm failure.**
- [ ] **Step 3: Implement** - `autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true;` and override `quitAndInstall` when dirty with a dialog: "Save or discard your draft before restarting."
- [ ] **Step 4: Verify** - publish a 0.0.2 build to a local static feed, confirm the prompt appears and the restart applies it.
- [ ] **Step 5: Commit** - `feat(desktop): auto-update with dirty guard`

---

### Phase D - Packaging and release

---

#### Task 10: Package for Windows

**Files:**
- Create: `desktop/electron-builder.yml`, `desktop/resources/icon.ico`
- Modify: `desktop/package.json` (`build` script)

**Interfaces:**
- `npm --prefix desktop run dist` produces `desktop/release/Nested-Setup-<version>.exe` and `Nested-<version>-portable.exe`.

- [ ] **Step 1: Configure** - `files` must include `dist/**`, `../.next/standalone/**`, `../.next/static/**`, `../public/**`; `asar: true`; `extraResources` for standalone. `nsis: { oneClick: false, perMachine: false }` so installs are per-user and need no admin.
- [ ] **Step 2: Verify the package runs** - install on a clean Windows VM, sign in, create a file, save, restart, confirm the file is still there.
- [ ] **Step 3: Verify the server is inside the package** - `.next/standalone/server.js` present under `resources/`, and `%APPDATA%\Nested\logs\server.log` is created on launch.
- [ ] **Step 4: Measure** - record installer size and cold-start time in `desktop/README.md`; expected 90-140 MB installer, under 4 s to first paint on a warm start.
- [ ] **Step 5: Commit** - `feat(desktop): windows packaging`

---

#### Task 11: Code signing

**Files:**
- Modify: `desktop/electron-builder.yml`
- Modify: `desktop/README.md`

**Interfaces:**
- Env: `CSC_LINK`, `CSC_KEY_PASSWORD`.

- [ ] **Step 1: Obtain a certificate** - an OV or EV code-signing certificate for the operator identity. Record the issuer and expiry in `desktop/README.md` (no secrets).
- [ ] **Step 2: Configure** - `win: { signingHashAlgorithms: ["sha256"], certificateSubjectName: "<operator>" }` or `CSC_LINK` from CI secrets.
- [ ] **Step 3: Verify** - `signtool verify /pa /v Nested-Setup-*.exe` passes and Windows SmartScreen shows the publisher name.
- [ ] **Step 4: Commit** - `chore(desktop): signing configuration`

---

#### Task 12: Release workflow

**Files:**
- Create: `.github/workflows/desktop-release.yml`
- Modify: `docs/INCIDENT.md`

- [ ] **Step 1: Write the workflow** - trigger on tag `desktop-v*`; steps: checkout, setup-node 20, `npm ci`, `npm run typecheck && npm test && npm run lint`, `npm run build:desktop`, `npm --prefix desktop ci && npm --prefix desktop run build`, `npm --prefix desktop run dist -- --publish always`.
- [ ] **Step 2: Add the web guard** - a separate job runs the web `npm run build` so Task 1 cannot regress Vercel.
- [ ] **Step 3: Verify** - push `desktop-v0.1.0`; a draft release appears with two artefacts and `latest.yml`.
- [ ] **Step 4: Document** - `docs/INCIDENT.md` gets "Desktop release failed", "Users on a broken build" (roll back by deleting the release and publishing a higher version; `electron-updater` never downgrades), and "Signing certificate expired".
- [ ] **Step 5: Commit** - `ci(desktop): signed release pipeline`

---

### Phase E - Optional, not v1

Ship v1 without these. They are separate plans when the need is real.

| Feature | Why it is deferred | Rough shape |
|---|---|---|
| Offline read cache | Needs a local mirror + invalidation; the product is explicitly online and multi-device | Service worker cache of the tree and last 20 files, read-only, banner when stale |
| Offline writes | Conflicts with revision-checked saves unless a sync queue is designed | Local SQLite journal keyed by `file_id` + `expected_revision`, replay on reconnect, surface `revision_conflict` as today |
| Bundled Pyodide | 10 MB download from jsDelivr on first Python run; already cached by Chromium after that | Copy `pyodide/*` into `public/pyodide/` at build time and point `indexURL` at `/pyodide/` when `NEXT_PUBLIC_DESKTOP === "1"` |
| macOS / Linux | Signing and notarisation cost, no users yet | Add `mac`/`linux` targets to the same `electron-builder.yml` |
| Local runner for Go/Rust/C++ | Would mean shipping compilers | Keep Judge0; the panel already says the code leaves the machine |

---

## 6. Parity matrix

| Capability | Web | Desktop v1 | Notes |
|---|---|---|---|
| Auth | Google via Supabase | Same, loopback redirect | Different redirect URI only |
| Files, versions, snapshots, trash | Yes | Yes | Identical server code |
| Runner (JS/TS/Python/SQL/HTML/CSS) | Worker + iframe | Same | `SharedArrayBuffer` works: WebView is Chromium and COOP/COEP headers are unchanged |
| Remote runner (Java/C++/Go/Rust/Bash) | `/api/run` | Same | Still needs network |
| Export zip / account data | Yes | Yes, plus native save dialog | |
| Admin panel | Yes | Yes | Same account flag |
| Auto-update | n/a | Yes | |
| Deep links | n/a | `nested://file/<id>` | |
| Offline | No | No | Deliberate |

---

## 7. Risks and how the plan absorbs them

| Risk | Mitigation |
|---|---|
| Google rejects the OAuth client or the loopback URI | Task 5 is self-contained; fall back to the existing Supabase hosted flow inside the browser and a one-time pairing code if loopback is blocked |
| Antivirus flags an unsigned NSIS installer | Task 11 before public distribution; publish checksums in the release notes |
| Electron shell outruns the web app | `desktop/package.json` pins the exact Electron version; upgrades are their own task with a smoke run |
| The standalone server behaves differently from Vercel | Task 10 step 2 runs the full sign-in/save/restart loop on a clean VM; Task 12 keeps the web build in the same pipeline |
| Users expect local-only storage | Landing copy states "your notes live in your Nested account, not on this device"; the export button stays one click away |
| A second copy of business logic appears in `desktop/` | Constraint: no Supabase calls, no file-tree logic in the shell. IPC only moves bytes and opens dialogs |

---

## 8. Definition of done for v1

- Signed installer installs per-user without admin rights on a clean Windows 11 VM.
- Sign in with Google completes in the system browser and returns to the app.
- Create, edit, save, version, snapshot, export, trash and restore behave identically to the web build.
- `curl http://127.0.0.1:43110/app` without the handshake header returns 403.
- Killing the server child recovers the window without a restart.
- Update from v0.1.0 to v0.1.1 works, and refuses while a file is dirty.
- Web build is unchanged and still passes `npm run build && npm run smoke`.
- `desktop/README.md` records build, sign, release and rollback steps, and `docs/INCIDENT.md` covers desktop failure modes.

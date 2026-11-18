# Nested for Windows

An Electron shell around the same Next.js app the web deployment serves. The
main process starts the Next standalone server on `127.0.0.1:43110` and loads
it in one window. There is no second backend: the server is the same
stateless code, talking to the same Supabase project.

## Platform targets and budgets

| | |
|---|---|
| OS | Windows 10 22H2 and Windows 11, x64 |
| macOS / Linux / arm64 | Not supported in 0.1.x |
| Windows 10 pre-22H2 | Not supported (WebView2 is not used; Electron ships Chromium, but the OS is out of test scope) |
| Window model | One window, single instance, quit on close, no tray |
| Offline | Not supported: the app needs the network for every read and write. It is a local *shell*, not a local store. |
| Installer | NSIS per-user (~122 MB) and portable (~109 MB) |
| Cold start | Measured 4-6 s to first paint on this machine (server boot included); budget 8 s |
| Idle RAM | ~250 MB total (Electron + Next server); budget 400 MB |
| Disk | ~250 MB installed; budget 400 MB |
| Data on device | Session cookies (Chromium/DPAPI), IndexedDB drafts, `%APPDATA%\nested-desktop\logs`, update cache |
| Data on server | Everything the user creates, in Supabase |

## Build

```bash
npm run build:desktop              # emits .next/standalone (must run first)
npm --prefix desktop run build     # compiles the shell to desktop/dist
npm --prefix desktop run pack      # unpacked app in AppData/Local/nested-desktop-build
npm --prefix desktop run dist      # NSIS installer + portable exe
```

Output goes to `C:\Users\<you>\AppData\Local\nested-desktop-build`, deliberately
outside OneDrive: file sync and antivirus hold locks on freshly extracted
binaries, which makes electron-builder's atomic rename fail with `EBUSY`.

`npm --prefix desktop run smoke -- full` boots the packaged server path and
proves the loopback guard rejects an unauthenticated request.

## How the pieces fit

| File | Responsibility |
|---|---|
| `src/main.ts` | lifecycle, window, IPC, deep links, update wiring |
| `src/server.ts` | spawns and stops the Next server; never touches Supabase |
| `src/menu.ts` + `menu-spec.ts` | menu; commands are replayed as key events so the renderer keeps one implementation |
| `src/oauth-urls.ts` | which navigations must leave for the system browser |
| `src/files.ts` | import/export validation (2 MB cap, binary rejection, name sanitising) |
| `src/protocol.ts` | `nested://file/<uuid>` parsing |
| `src/update-guard.ts` | whether an update may restart now |
| `src/updater.ts` | electron-updater wiring |
| `scripts/copy-standalone.mjs` | afterPack hook; electron-builder's extraResources drops `node_modules`, so the server tree is copied explicitly |

## Signing

Not configured yet. Both installers are unsigned, so SmartScreen warns on first
run and the publisher shows as "Unknown". Before public distribution:

1. Obtain an OV or EV code-signing certificate for the operator identity.
2. Set `CSC_LINK` (base64 pfx or path) and `CSC_KEY_PASSWORD` in the release
   environment. `electron-builder.yml` already sets `signingHashAlgorithms`.
3. Verify with `signtool verify /pa /v Nested-Setup-*.exe`.

Never commit a certificate. Record the issuer and expiry here, not the secret.

## Release

Tag `desktop-v<version>` and push. `.github/workflows/desktop-release.yml` runs
the web build as a guard, builds the standalone server, packages both targets,
and uploads them to a draft GitHub release. Publishing the release is what makes
`electron-updater` see it.

Rollback: delete the bad release and publish a higher version. `electron-updater`
never downgrades, so a lower version number is not a fix.

## Known gaps

- The renderer does not yet call `window.nested.openFile/saveFile/setDirty`.
  The IPC surface is built and tested; wiring it needs a product decision about
  where an imported file lands (new file at root? into the open project?).
- No application icon; electron-builder falls back to the default Electron icon.
- Portable exe cannot be smoke-tested from a shell because it self-extracts and
  detaches stdout. Launch it by hand once per release.


## Uninstall and local data

Uninstalling removes the program from `%LOCALAPPDATA%\Programs\Nested`. It does
**not** delete:

- `%APPDATA%\nested-desktop` - logs (`main.log`, `server.log`) and the saved
  window position
- Chromium's session storage for the app (the Supabase session cookie, encrypted
  by Windows DPAPI)
- the update cache under `%LOCALAPPDATA%\nested-desktop-updater`

That is deliberate: reinstalling keeps you signed in. To start clean, sign out
in the app, then delete those three folders. No user documents exist on disk —
every file lives in the account.

# Desktop plan - execution ledger

Branch `bionic/desktop-app`. Inline execution, no subagent tool.

## Progress

| Task | State | Evidence |
|---|---|---|
| 1. Standalone output | done | `npm run test:desktop`; `.next/standalone/server.js` emitted; web build green |
| 2. Electron shell | done | `smoke` -> `{"windows":1,...}` |
| 3. Server lifecycle | done | `smoke -- full` -> `{"server":true,"guarded":true,...}` |
| 4. Loopback guard | done | 5 guard tests; live 403 without header |
| 5. System-browser OAuth | done | 5 URL-routing tests; docs updated |
| 6. Menu + shortcuts | done | menu-spec tests; commands replayed as key events |
| 7. File open/save IPC | done | 6 validation tests; IPC wired to preload |
| 8. Deep links | done | 6 protocol tests; second-instance + startup argv |
| 9. Auto-update + dirty guard | done | 4 guard tests; updater wired behind `app.isPackaged` |
| 10. Windows packaging | done | `Nested-Setup-0.1.0.exe` 122 MB, `Nested-Portable-0.1.0.exe` 109 MB |
| 11. Code signing | blocked | no certificate; steps in `desktop/README.md` |
| 12. Release workflow | done | `.github/workflows/desktop-release.yml` (not executed; no push) |

Total desktop tests: 29. Root tests: 38. Typecheck clean for both projects.

## Rulings

- **Packaged server failed with `Cannot find module 'next'`** - electron-builder's
  `extraResources` silently drops `node_modules`. Replaced it with an `afterPack`
  hook (`scripts/copy-standalone.mjs`) that copies the tree explicitly. Cost: one
  more build script to maintain.
- **`EBUSY` on `default_app.asar`** - OneDrive sync and antivirus hold locks on
  freshly extracted binaries, so electron-builder's atomic rename fails. Output
  moved to `%LOCALAPPDATA%\nested-desktop-build`. Cost: artifacts are not inside
  the repo (good for size, worse for discovery; path is in `desktop/README.md`).
- **NSIS and portable wrote the same filename** - both targets defaulted to
  `${productName}-${version}-${arch}.${ext}`; portable overwrote the installer.
  Fixed with per-target `artifactName`.
- **Renderer wiring deferred** - `openFile`/`saveFile`/`setDirty` exist on
  `window.nested` and are tested, but no UI calls them. There is no import
  affordance in the app to attach to, and where an imported file lands is a
  product decision. Cost: the desktop build has IPC it does not yet use.
- **Menu commands replay key events** rather than adding IPC. Cost: if the
  renderer changes a shortcut, the menu must follow; both live in one spec file.
- **Updater enabled only when packaged** so dev builds never hit the update feed.

## Verified end to end

- Packaged `Nested.exe` (unpacked build) with `NESTED_SMOKE=full` ->
  `{"server":true,"guarded":true,"tokenLength":64}`: the server boots from
  `resources/standalone`, and an unauthenticated loopback request is refused.
- Portable exe launches and exits 0 under the same flag, but its wrapper detaches
  stdout, so the JSON cannot be read there. Launch it by hand once per release.

## Open

- Signing (Task 11) and a manual install on a clean VM.
- No app icon.
- Playwright `_electron` suite still not installed; coverage is Node tests plus
  the `NESTED_SMOKE=full` boot path.


## After Phase D

- **SEC-004 fixed** in code and schema: `set_my_username` / `set_my_email` definer
  RPCs (`20261113120000_identity_change_rpc.sql`); actions call them. The
  migration still has to be pushed before the feature works in production.
- **SEC-010 fixed** with it: the "username is taken" pre-check is gone, so a
  signed-in user can no longer enumerate usernames.
- **SEC-002 fixed**: `/api/errors` no longer scans and deletes on every request;
  retention moved to `pg_cron` (`20261113120100_purge_error_events.sql`).
- **SEC-005 fixed**: sitemap uses `SITE_URL`, lists `/terms` and `/privacy`.
- **SEC-006 fixed**: security.txt `Canonical` is absolute.
- **SEC-007 fixed**: in production the request origin comes from configuration,
  never from `X-Forwarded-Host`.
- **SEC-008 fixed**: `.env.example` documents `CRON_SECRET` and
  `SUPABASE_SERVICE_ROLE_KEY`.
- **Desktop IPC wired**: `DesktopBridge` forwards `nested:dirty` to the main
  process and turns a File-menu pick into a new root file. `CmdOrCtrl+O` added.

Ruling: an imported file lands at the project root with its name preserved
(markdown unless the extension maps to a known language). Cost if wrong: users
who expected it inside the open project move it one step.

Known slip: commit `3c361b6` also captured two pre-existing worktree edits
(`src/app/app/file-pane.tsx`, `src/lib/languages.ts`) that I did not author.
Nothing was reverted; they are simply committed alongside the audit fixes.

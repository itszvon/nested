# Desktop production-readiness audit

**App:** Nested 0.1.1 (Electron 45.3.1, Next.js 16 standalone on loopback)
**Checklist:** Complete Desktop App Production-Readiness Master Checklist v1.0 (Nov 2026)
**Track:** C - website-to-desktop conversion. Sections 1-15 plus 16-18, and 19.
**Date:** 2026-11-18
**Build under review:** `Nested-Setup-0.1.1.exe`, SHA-256 `193bb5d4...12d56`

---

## Verdict

**NOT READY.**

By this checklist's own gate, an unsigned artifact whose update path cannot be
verified is a **P0**, and "the signed artifacts install and launch on every
supported platform" is a precondition for READY. Neither holds yet.

The engineering underneath is in decent shape: renderer sandboxed, IPC narrow
and validated, single writer, no local data store to corrupt, loopback locked
behind a per-launch token, and a packaged build that boots its own server.

**Conditionally Ready** would be the honest label *after* the certificate exists
and one clean-machine install + upgrade is recorded; today the certificate is
absent, so the P0 stands.

| | Count |
|---|---|
| Sections PASS | 6 |
| Sections PARTIAL | 11 |
| Sections FAIL | 1 |
| Sections NOT APPLICABLE | 1 |
| Findings P0 | 1 |
| Findings P1 | 3 |
| Findings P2 | 5 |
| Findings P3 | 3 |

---

## Section results

| § | Section | Status | Evidence |
|---|---|---|---|
| 1 | Product definition, platforms | **PASS** | Platforms, window model, offline stance, budgets and data locations now in `desktop/README.md` |
| 2 | Architecture and process model | **PASS** | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; preload exposes six named calls; IPC validated in main; logic testable without UI (29 tests) |
| 3 | Security, sandboxing, supply chain | **PARTIAL** | Renderer untrusted and IPC validated; CSP inherited from the web app keeps `unsafe-eval`/`unsafe-inline` (SEC-003); updates unsigned; no SBOM or licence inventory |
| 4 | Local data and integrity | **PARTIAL** | Single writer (the server); logs rotated at 1 MB; no local database. Uninstall/reinstall behaviour not verified; logs and cookies survive uninstall by design |
| 5 | OS integration | **PARTIAL** | Native menu with platform roles, deep links through the single-instance lock, external links to the system browser. No window-position restore, no tray (intentional), no recent files |
| 6 | Packaging, installers, signing | **PARTIAL** | CI workflow written but never executed; per-user NSIS + portable; custom icon; **unsigned**; clean install/upgrade/uninstall unverified |
| 7 | Updates, rollback, versioning | **FAIL** | `electron-updater` wired to GitHub but no release has ever been published, the feed is unpinned/unsigned, there is no channel model, and no rollout gate |
| 8 | Performance and footprint | **PARTIAL** | Budgets documented; cold start 4-6 s measured once; idle RAM/CPU, cold cache and long-session growth unmeasured |
| 9 | UX, accessibility, window behaviour | **PARTIAL** | Keyboard-first UI, explicit empty/error states in the app; screen reader and 200 % scaling untested; window position not restored |
| 10 | Legal, licensing, compliance | **PARTIAL** | Terms/privacy/security reachable from Help (open in browser); no in-app licence list or NOTICE file |
| 11 | Privacy, telemetry, data handling | **PASS** | No analytics; error intake carries message/stack/URL path only, never content; retention via `pg_cron`; account deletion exists |
| 12 | AI / LLM features | **NOT APPLICABLE** | No model calls. The code runner is a deterministic sandbox |
| 13 | QA and test matrix | **FAIL** | No clean VM, no OS matrix, no offline or mid-operation network-loss test, no upgrade/downgrade test, no high-DPI or second-monitor test |
| 14 | Observability and support | **PARTIAL** | Main-process crash log added today; renderer errors go to the admin error table; About shows version/runtime/OS and copies. No symbol upload, no crash-free metric |
| 15 | Release management, EOL | **PARTIAL** | Semver, one release owner, rollback note. No channels, staging or EOL policy |
| 16 | Conversion scope and parity | **PARTIAL** | Loading model documented (loopback + same server); web-only chrome removed; no written parity matrix |
| 17 | Runtime, auth, migration | **PASS** | System-browser OAuth with loopback redirect, navigation interception, fresh start accepted (no browser data migration) |
| 18 | Conversion assumptions and branding | **PARTIAL** | Shell-specific security derived (token guard, host check); no staging endpoints inherited; CSP still the web one |
| 19 | Vibe-coding controls | **PASS** | Every change has a test or a packaged-build check; commands documented in `desktop/README.md`; no secrets in prompts |

---

## Findings

| ID | P | Finding | Fix |
|---|---|---|---|
| PKG-001 | **P0** | Artifacts are unsigned and the update path verifies no signature | Buy an OV/EV certificate, set `CSC_LINK`, publish, then test an install |
| PKG-002 | P1 | 0.1.1 has never been installed on a clean machine; 0.1.0 shipped a launch-blocking bug that a packaged smoke test caught only later | Install on a clean VM as a standard user; record the run |
| UPD-001 | P1 | `publish` points at `github/itszvon/nested`; if that repo does not exist or no release is published, update checks 404 silently and nothing ever updates | Confirm the repo, publish a draft release on the tag, watch one check succeed |
| CI-001 | P1 | `.github/workflows/desktop-release.yml` has never run | Push tag `desktop-v0.1.1`, confirm both artefacts appear |
| SEC-004 | P2 | Inherited CSP allows `unsafe-eval` and `unsafe-inline`; the runner needs them, app pages do not | Split the policy per route |
| DATA-001 | P2 | Uninstall removes the program but leaves `%APPDATA%\nested-desktop` (logs, cookies) | Verify and document; offer a "clear local data" action |
| A11Y-001 | P2 | No screen-reader or 200 % text-scaling pass on the desktop shell | Run Narrator through sign-in, file open, save |
| OBS-001 | P2 | No crash-free session rate, no symbol upload | Optional Sentry for the desktop build with the same `beforeSend` scrub |
| PERF-001 | P2 | Idle CPU and long-session memory unmeasured | Leave the app open 8 h, sample CPU/RAM |
| LEG-001 | P3 | No licence inventory / NOTICE in the app | Generate from `package-lock.json`, add Help → Licences |
| UX-001 | P3 | Window position and size not restored across launches | Persist bounds, clamp to the visible display |
| CONV-001 | P3 | No written parity matrix against the web app | One table: kept / adapted / native / dropped |

`SEC-004` here is unrelated to the web audit's SEC-004 (identity change), which
is fixed and live.

---

## What changed during this audit

- `Help -> About` with version, Electron, Chromium, Node, OS, and a copy button (§14).
- Main-process crash logging to `%APPDATA%\nested-desktop\logs\main.log`, rotated at 1 MB (§14).
- Platform targets, budgets, data locations and offline stance documented (§1).
- Checksums and release notes published for 0.1.1 (§6, §7).

## What would move this to CONDITIONALLY READY

1. A certificate and a signed installer that installs on a clean VM.
2. One recorded upgrade from 0.1.0 to 0.1.1.
3. A published GitHub release so the update feed exists.

## What would move it to READY

Everything above, plus: a clean install on the oldest supported OS, an offline
and network-loss pass, a screen-reader pass, and a signature check in the update
path that fails closed.

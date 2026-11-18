# Third-party notices

Nested bundles the following components. Full licence texts ship with each
package in `node_modules`; this file records what is included and under which
licence, so a redistribution can comply.

| Component | Licence | Where |
|---|---|---|
| Electron | MIT | desktop shell runtime |
| Chromium | BSD-3-Clause and others | embedded in Electron |
| Node.js | MIT | embedded in Electron (`ELECTRON_RUN_AS_NODE`) |
| Next.js | MIT | server bundled into `resources/standalone` |
| React / React DOM | MIT | renderer bundle |
| electron-updater | MIT | update checks |
| @supabase/supabase-js, @supabase/ssr | MIT | data and auth |
| CodeMirror 6 packages | MIT | editor |
| fflate, js-yaml, sucrase, zod, diff, idb | MIT | utilities |
| Geist and Geist Mono | SIL Open Font License 1.1 | interface typeface |
| Pyodide | MPL-2.0 | downloaded at run time from jsDelivr, not bundled |

Not included: Judge0 (external service, used only when a remote language is
run), Sentry (optional, off unless a DSN is configured), Supabase (hosted
service).

Chromium's own notice file is inside the Electron distribution
(`resources/electron.asar` and `LICENSE`); it is not duplicated here.

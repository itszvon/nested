# What runs inside Nested

Last verified: 2026-11-02 against the code in `src/lib/languages.ts`,
`src/lib/runner-worker.ts`, `src/lib/run-remote.ts` and the public Judge0 CE
endpoint (`https://ce.judge0.com`, the default when `NESTED_RUNNER_URL` is
unset).

This is the honest answer to "will Run actually do something?" It is more
specific than the three words in the picker.

## Runs successfully

| Language | Tier | Where it executes | Status |
|---|---|---|---|
| Python | `runs` | Browser worker, Pyodide 0.26.4 from jsDelivr | Works. First run downloads about 10 MB. |
| JavaScript | `runs` | Browser worker, `eval` after network/storage stubs | Works. |
| TypeScript | `runs` | Browser worker; types stripped by Sucrase, then run as JavaScript | Works for syntax and execution. **No type checking.** |
| SQL | `runs` | Browser worker, SQLite via sql.js | Works. It is SQLite, not Postgres/MySQL. |
| HTML | `preview` | Sandboxed iframe (`allow-scripts`, opaque origin) | Renders. Inline `<script>` also runs inside the preview, but this is not treated as a program runner. |
| CSS | `preview` | Sandboxed iframe with fixed sample markup | Renders the stylesheet only. |
| JSON | `checks` | Browser, `JSON.parse` | Validates and prints the parsed value. Nothing executes. |
| YAML | `checks` | Browser, `js-yaml` | Validates and prints the parsed value. Nothing executes. |
| Java | `remote` | Judge0 CE id 91 (JDK 17) | Verified: `Accepted`, output returned. |
| C++ | `remote` | Judge0 CE id 105 (GCC 14) | Verified: `Accepted`, output returned. |
| Go | `remote` | Judge0 CE id 107 (Go 1.23) | Verified: `Accepted`, output returned. |
| Rust | `remote` | Judge0 CE id 108 (Rust 1.85) | Verified: `Accepted`, output returned. |
| Bash | `remote` | Judge0 CE id 46 (Bash 5.0) | Verified: `Accepted`, output returned. |

All five remote ids were confirmed to exist in the judge's `/languages` list
and to compile and run a hello-world submission on the verification date.

## Does not run

| Language / feature | Why | What happens in the app |
|---|---|---|
| Plain text, Markdown | No runtime configured | Edit, highlight (Markdown is still plain text), save. Run is not offered. |
| Python GUI imports (`tkinter`, `turtle`, `curses`, `idlelib`) | A browser worker has no window system or terminal | The runner detects the import before starting and prints one sentence saying to use Python on your machine. |
| Python packages outside the Pyodide bundle | Only the bundled stdlib is preloaded; this build does not call `loadPackage` for third-party wheels | `ModuleNotFoundError`. Standard-library code works; NumPy/pandas/etc. are not guaranteed. |
| Network, sockets, file storage in Python/JS/TS/SQL | Deliberately stubbed out after the runtime starts | `fetch`, WebSocket, IndexedDB and friends throw inside the runner. |
| SQL dialects other than SQLite | sql.js is SQLite compiled to WebAssembly | Postgres-only syntax (e.g. `SERIAL`, `ILIKE`) can fail. |
| Any language not in `LANGUAGE_INFO` | No parser, no runtime, no remote id | Edit only; the Run panel explains that it does not run in Nested. |

## Requirements and limits

- **Remote languages leave the browser.** Java, C++, Go, Rust and Bash are
  POSTed to `/api/run`, which forwards them to Judge0. They require a signed-in
  account and are rate-limited to 8 runs per minute per user.
- **Remote limits:** 200,000 characters of code, 45 s client timeout, 5 s CPU,
  12 s wall clock, 256 MB memory in the judge.
- **Public endpoint caveat:** `https://ce.judge0.com` is a shared free service.
  It can be slow, rate-limited, or refuse requests. On 2026-11-02 the endpoint
  answered `200`, Node's `fetch` (what the server route uses) submitted
  successfully, and all five ids ran. A Python `urllib` request from the same
  machine got Cloudflare `403 error code: 1010`, so verification uses a normal
  HTTP client; if the live host is blocked, point `NESTED_RUNNER_URL` at a
  self-hosted Judge0 instance and keep the same ids.
- **Browser languages need cross-origin isolation.** Python, JavaScript,
  TypeScript and SQL use a `SharedArrayBuffer`; the app sends COOP/COEP headers
  for this. If a proxy strips them, those four report "needs cross-origin
  isolation" and do not start. HTML/CSS previews do not need it.
- **Browser language assets come from `cdn.jsdelivr.net`.** Pyodide, sql.js and
  Prettier were confirmed reachable (`200`) and jsDelivr sends
  `cross-origin-resource-policy: cross-origin`, so the app's COEP header does not
  block them.

## Formatting (separate from running)

`src/lib/format.ts` currently formats only **JavaScript, TypeScript, HTML and
CSS** with Prettier. Java, Python, C++, Go, Rust, SQL and Bash have no Format
button in this build, regardless of what older planning notes said.

## How to re-check

```bash
# Every remote language id the app knows about
curl -sS https://ce.judge0.com/languages

# A live submission (Bash shown)
curl -sS -H "Content-Type: application/json" \
  -X POST "https://ce.judge0.com/submissions?base64_encoded=false&wait=true&fields=*" \
  -d '{"source_code":"echo hi","language_id":46,"stdin":""}'
```

If you change a Judge0 id in `src/lib/run-remote.ts`, repeat the submission
against the new id before shipping.

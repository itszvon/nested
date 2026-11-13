/**
 * Runs the built shell under Electron and asserts its report.
 *
 *   node scripts/run-smoke.mjs        -> window created
 *   node scripts/run-smoke.mjs full   -> window + local Next server boot
 *
 * Resolving the Electron binary here keeps this working on Windows without a
 * shell-specific environment prefix.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "1";

const result = spawnSync(electronPath, [join(root, "dist", "main.js")], {
  cwd: root,
  env: { ...process.env, NESTED_SMOKE: mode },
  encoding: "utf8",
  timeout: mode === "full" ? 60_000 : 30_000,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || `electron exited ${result.status}\n`);
  process.exit(1);
}

const line = (result.stdout || "").trim().split("\n").pop() ?? "";
const parsed = JSON.parse(line);
const ok =
  mode === "full" ? parsed.server === true && parsed.guarded === true : parsed.windows === 1;

if (!ok || parsed.tokenLength !== 64) {
  process.stderr.write(`unexpected shell report: ${line}\n`);
  process.exit(1);
}

process.stdout.write(`shell ok ${line}\n`);

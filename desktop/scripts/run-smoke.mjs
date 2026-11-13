/**
 * Runs the built shell with NESTED_SMOKE=1 and asserts it reports a window.
 * Resolving the Electron binary here keeps `npm run smoke` working on Windows
 * without a shell-specific env prefix.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(electronPath, [join(root, "dist", "main.js")], {
  cwd: root,
  env: { ...process.env, NESTED_SMOKE: "1" },
  encoding: "utf8",
  timeout: 30_000,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || "electron exited non-zero\n");
  process.exit(1);
}

const line = (result.stdout || "").trim().split("\n").pop() ?? "";
const parsed = JSON.parse(line);

if (parsed.windows !== 1 || parsed.tokenLength !== 64) {
  process.stderr.write(`unexpected shell report: ${line}\n`);
  process.exit(1);
}

process.stdout.write(`shell ok ${line}\n`);

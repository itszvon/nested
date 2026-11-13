/**
 * Desktop build: `next build` with `output: "standalone"`.
 *
 * The flag has to be set before the config module loads, and npm scripts on
 * Windows run through cmd.exe where `VAR=1 cmd` is not valid shell syntax.
 * A tiny launcher keeps one command working on every platform.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const result = spawnSync(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DESKTOP_BUILD: "1" },
});

process.exit(result.status ?? 1);

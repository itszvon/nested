/**
 * Copies the Next standalone server next to the packaged app.
 *
 * electron-builder's extraResources matcher drops `node_modules` directories,
 * and the standalone server cannot boot without them, so the copy is explicit
 * here. Layout must match `standaloneEntry()`:
 *
 *   resources/standalone/server.js
 *   resources/standalone/node_modules/...
 *   resources/standalone/.next/static/...
 *   resources/standalone/public/...
 */
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export default async function afterPack(context) {
  const target = join(context.appOutDir, "resources", "standalone");
  const standalone = join(repo, ".next", "standalone");

  if (!existsSync(join(standalone, "server.js"))) {
    throw new Error("Missing .next/standalone/server.js - run `npm run build:desktop` first.");
  }

  await cp(standalone, target, { recursive: true, force: true });
  await cp(join(repo, ".next", "static"), join(target, ".next", "static"), {
    recursive: true,
    force: true,
  });
  await cp(join(repo, "public"), join(target, "public"), { recursive: true, force: true });
}

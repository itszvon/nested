import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * `output: "standalone"` must be opt-in: the Vercel build keeps its own
 * output mode, and only the desktop build emits a server entry.
 *
 * The config is a module with a side-effectful export, so each case is
 * loaded in a fresh process rather than re-imported.
 */
const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, "../../next.config.ts");

function outputWithDesktopBuild(enabled: boolean): string {
  const env = { ...process.env };
  if (enabled) env.NEXT_DESKTOP_BUILD = "1";
  else delete env.NEXT_DESKTOP_BUILD;

  const specifier = pathToFileURL(configPath).href;
  const script = `import(${JSON.stringify(specifier)}).then((m) => console.log(String(m.default.output)))`;
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", script],
    { env, encoding: "utf8", cwd: resolve(here, "../..") },
  );

  assert.equal(result.status, 0, result.stderr || "config failed to load");
  return result.stdout.trim();
}

test("web build leaves output to the platform", () => {
  assert.equal(outputWithDesktopBuild(false), "undefined");
});

test("desktop build emits a standalone server", () => {
  assert.equal(outputWithDesktopBuild(true), "standalone");
});

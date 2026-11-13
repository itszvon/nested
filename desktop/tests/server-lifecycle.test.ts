import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer, stopServer, waitForServer } from "../src/server.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const entry = join(repo, ".next", "standalone", "server.js");

test("waitForServer gives up on a port nothing is listening on", async () => {
  const started = Date.now();
  const ok = await waitForServer("http://127.0.0.1:49999", 1200);
  assert.equal(ok, false);
  assert.ok(Date.now() - started < 4000, "should stop near the deadline");
});

test("a spawned server answers and shuts down", { skip: !existsSync(entry) }, async () => {
  const port = 43111;
  const origin = `http://127.0.0.1:${port}`;
  const child = startServer({ entry, port, token: "test-token" });

  try {
    assert.equal(await waitForServer(origin, 30_000), true);
  } finally {
    await stopServer(child);
  }

  assert.equal(await waitForServer(origin, 600), false);
});

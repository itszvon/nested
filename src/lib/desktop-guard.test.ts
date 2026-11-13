import test from "node:test";
import assert from "node:assert/strict";
import { desktopGuard } from "./desktop-guard.ts";

const config = { token: "abc123", host: "127.0.0.1:43110" };

test("web deployment is never guarded", () => {
  assert.equal(desktopGuard(new Headers(), {}), "ok");
});

test("missing token is forbidden", () => {
  assert.equal(desktopGuard(new Headers({ host: "127.0.0.1:43110" }), config), "forbidden");
});

test("wrong host is forbidden even with the right token", () => {
  const headers = new Headers({ host: "evil.example", "x-nested-desktop": "abc123" });
  assert.equal(desktopGuard(headers, config), "forbidden");
});

test("correct host and token pass", () => {
  const headers = new Headers({ host: "127.0.0.1:43110", "x-nested-desktop": "abc123" });
  assert.equal(desktopGuard(headers, config), "ok");
});

test("a prefix of the token does not pass", () => {
  const headers = new Headers({ host: "127.0.0.1:43110", "x-nested-desktop": "abc12" });
  assert.equal(desktopGuard(headers, config), "forbidden");
});

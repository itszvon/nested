import test from "node:test";
import assert from "node:assert/strict";
import { FILE_MENU, HELP_MENU, VIEW_MENU } from "../src/menu-spec.ts";

test("file menu covers the shortcuts the app already implements", () => {
  assert.deepEqual(
    FILE_MENU.map((item) => item.label),
    ["New File", "Save", "Command Palette"],
  );
  assert.equal(FILE_MENU.find((item) => item.label === "Save")?.accelerator, "CmdOrCtrl+S");
});

test("every file command carries a key to forward", () => {
  for (const item of FILE_MENU) {
    assert.ok(item.key, `${item.label} needs a key`);
  }
});

test("view menu uses native roles", () => {
  for (const item of VIEW_MENU) {
    assert.ok(item.role, `${item.label} should be a role`);
  }
});

test("help menu points at real policy routes", () => {
  assert.deepEqual(
    HELP_MENU.map((item) => item.url),
    ["/privacy", "/security", "/terms"],
  );
});

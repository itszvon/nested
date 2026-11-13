import test from "node:test";
import assert from "node:assert/strict";
import { createDirtyGuard } from "../src/update-guard.ts";

test("a clean app may restart", () => {
  assert.equal(createDirtyGuard().canRestart(), true);
});

test("a dirty app may not restart", () => {
  const guard = createDirtyGuard();
  guard.setDirty(true);
  assert.equal(guard.isDirty(), true);
  assert.equal(guard.canRestart(), false);
});

test("discarding or saving clears the block", () => {
  const guard = createDirtyGuard();
  guard.setDirty(true);
  guard.setDirty(false);
  assert.equal(guard.canRestart(), true);
});

test("only literal true marks the app dirty", () => {
  const guard = createDirtyGuard();
  guard.setDirty("yes" as unknown as boolean);
  assert.equal(guard.isDirty(), false);
});

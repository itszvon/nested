import test from "node:test";
import assert from "node:assert/strict";
import { buildDiffRows } from "./diff.ts";

test("identical content is all unchanged rows", () => {
  const { rows, truncated } = buildDiffRows("a\nb\n", "a\nb\n");
  assert.equal(truncated, false);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.left, row.right, row.leftNo, row.rightNo]),
    [
      ["same", "a", "a", 1, 1],
      ["same", "b", "b", 2, 2],
    ],
  );
});

test("a changed line is paired left and right", () => {
  const { rows } = buildDiffRows("old\n", "new\n");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "change");
  assert.equal(rows[0].left, "old");
  assert.equal(rows[0].right, "new");
  assert.equal(rows[0].leftNo, 1);
  assert.equal(rows[0].rightNo, 1);
});

test("an added line has no left side", () => {
  const { rows } = buildDiffRows("a\n", "a\nb\n");
  const added = rows.find((row) => row.kind === "add");
  assert.ok(added);
  assert.equal(added.left, null);
  assert.equal(added.right, "b");
  assert.equal(added.leftNo, null);
});

test("a removed line has no right side", () => {
  const { rows } = buildDiffRows("a\nb\n", "a\n");
  const removed = rows.find((row) => row.kind === "del");
  assert.ok(removed);
  assert.equal(removed.right, null);
  assert.equal(removed.left, "b");
  assert.equal(removed.rightNo, null);
});

test("line numbers advance per side", () => {
  const { rows } = buildDiffRows("a\nb\nc\n", "a\nc\n");
  assert.deepEqual(
    rows.map((row) => [row.leftNo, row.rightNo]),
    [
      [1, 1],
      [2, null],
      [3, 2],
    ],
  );
});

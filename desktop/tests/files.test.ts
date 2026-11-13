import test from "node:test";
import assert from "node:assert/strict";
import { MAX_FILE_BYTES, validateExport, validateImport, type ImportResult } from "../src/files.ts";

const enc = (text: string) => new TextEncoder().encode(text);

test("a normal text file imports with its basename", () => {
  const result = validateImport("C:\\notes\\plan.md", enc("# plan")) as ImportResult & { ok: true };
  assert.equal(result.ok, true);
  assert.equal(result.file.name, "plan.md");
  assert.equal(result.file.content, "# plan");
});

test("empty files are rejected", () => {
  const result = validateImport("a.txt", new Uint8Array());
  assert.equal(result.ok, false);
});

test("files over 2 MB are rejected before upload", () => {
  const result = validateImport("big.txt", new Uint8Array(MAX_FILE_BYTES + 1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /2 MB/);
});

test("binary files are refused", () => {
  const result = validateImport("image.png", new Uint8Array([0x89, 0x50, 0x00, 0x01]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /binary/);
});

test("export sanitises a hostile filename", () => {
  const result = validateExport('a<b>:"c|d?.txt', "hello");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.name, "a-b---c-d-.txt");
});

test("export refuses non-string content and empty files", () => {
  assert.equal(validateExport("a.txt", 42).ok, false);
  assert.equal(validateExport("a.txt", "").ok, false);
});

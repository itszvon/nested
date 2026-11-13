import test from "node:test";
import assert from "node:assert/strict";
import { findDeepLink, parseDeepLink } from "../src/protocol.ts";

const ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

test("a file link parses", () => {
  assert.deepEqual(parseDeepLink(`nested://file/${ID}`), { kind: "file", id: ID });
});

test("ids are normalised to lower case", () => {
  const upper = `nested://file/${ID.toUpperCase()}`;
  assert.deepEqual(parseDeepLink(upper), { kind: "file", id: ID });
});

test("non-uuid ids are refused", () => {
  assert.equal(parseDeepLink("nested://file/../../etc/passwd"), null);
  assert.equal(parseDeepLink("nested://file/abc"), null);
});

test("other schemes and hosts are refused", () => {
  assert.equal(parseDeepLink(`https://file/${ID}`), null);
  assert.equal(parseDeepLink(`nested://folder/${ID}`), null);
});

test("garbage is refused", () => {
  assert.equal(parseDeepLink(""), null);
  assert.equal(parseDeepLink("nested://"), null);
});

test("the deep link is found in a command line", () => {
  const link = `nested://file/${ID}`;
  assert.equal(findDeepLink(["Nested.exe", "--flag", link]), link);
  assert.equal(findDeepLink(["Nested.exe", "--flag"]), null);
});

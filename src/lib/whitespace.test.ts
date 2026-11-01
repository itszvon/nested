import test from "node:test";
import assert from "node:assert/strict";
import { tidyBlankLines, removeBlankLines, indentWidth } from "./whitespace.ts";

test("tidy inserts a blank line between Python definitions", () => {
  const input = "def a():\n    return 1\ndef b():\n    return 2";
  assert.equal(
    tidyBlankLines(input, "python"),
    "def a():\n    return 1\n\ndef b():\n    return 2",
  );
});

test("flat then tidy restores the section break", () => {
  const flat = removeBlankLines("def a():\n    return 1\n\ndef b():\n    return 2");
  assert.equal(
    tidyBlankLines(flat, "python"),
    "def a():\n    return 1\n\ndef b():\n    return 2",
  );
});

test("decorators stay attached to their def", () => {
  const input = "@dec\ndef a():\n    pass\ndef b():\n    pass";
  assert.equal(
    tidyBlankLines(input, "python"),
    "@dec\ndef a():\n    pass\n\ndef b():\n    pass",
  );
});

test("brace languages get a blank line between blocks", () => {
  const input = "function a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}";
  assert.equal(
    tidyBlankLines(input, "javascript"),
    "function a() {\n  return 1;\n}\n\nfunction b() {\n  return 2;\n}",
  );
});

test("else stays attached to the closing brace", () => {
  const input = "if (x) {\n  a();\n} else {\n  b();\n}";
  assert.equal(tidyBlankLines(input, "javascript"), input);
});

test("method chains are not split", () => {
  const input = "const a = foo()\n  .then(bar)\n  .catch(baz);\nconst b = 1;";
  assert.equal(tidyBlankLines(input, "javascript"), input);
});

test("CSS rules are separated but selectors keep their dot", () => {
  const input = ".a {\n  color: red;\n}\n.b {\n  color: blue;\n}";
  assert.equal(
    tidyBlankLines(input, "css"),
    ".a {\n  color: red;\n}\n\n.b {\n  color: blue;\n}",
  );
});

test("markdown collapses runs of blanks to one", () => {
  assert.equal(tidyBlankLines("one\n\n\ntwo", "markdown"), "one\n\ntwo");
});

test("indentWidth counts spaces and tabs", () => {
  assert.equal(indentWidth("    x"), 4);
  assert.equal(indentWidth("\tx"), 1);
  assert.equal(indentWidth("x"), 0);
});

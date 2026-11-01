import test from "node:test";
import assert from "node:assert/strict";
import { heuristicFindings, jsonFindings } from "./checks.ts";

function messages(text: string, language: string | null) {
  return heuristicFindings(text, language).map((finding) => finding.message);
}

test("clean Python produces no findings", () => {
  const code = "def add(a, b):\n    return a + b\n";
  assert.deepEqual(messages(code, "python"), []);
});

test("mixed tabs and spaces in indentation is flagged", () => {
  const code = "def f():\n \treturn 1\n";
  assert.match(messages(code, "python")[0], /Tabs and spaces/);
});

test("unused Python import is flagged", () => {
  const code = "import os\n\nprint('hi')\n";
  assert.ok(messages(code, "python").some((message) => message.includes("'os' is imported but never used")));
});

test("assignment inside a condition is flagged", () => {
  const code = "x = 0\nif x = 1:\n    pass\n";
  assert.ok(messages(code, "python").some((message) => message.includes("Assignment inside a condition")));
});

test("== inside a condition is not mistaken for assignment", () => {
  const code = "x = 1\nif x == 1:\n    pass\n";
  assert.ok(!messages(code, "python").some((message) => message.includes("Assignment inside")));
});

test("comparison to None with == is flagged", () => {
  const code = "if x == None:\n    pass\n";
  assert.ok(messages(code, "python").some((message) => message.includes("using 'is'")));
});

test("bare except is flagged", () => {
  const code = "try:\n    pass\nexcept:\n    pass\n";
  assert.ok(messages(code, "python").some((message) => message.includes("Bare 'except:'")));
});

test("mutable default argument is flagged", () => {
  const code = "def f(items=[]):\n    return items\n";
  assert.ok(messages(code, "python").some((message) => message.includes("Mutable default")));
});

test("loose equality in JavaScript is flagged", () => {
  const code = "if (a == b) {\n  run();\n}\n";
  assert.ok(messages(code, "javascript").some((message) => message.includes("Loose equality")));
});

test("strict equality is not flagged", () => {
  const code = "if (a === b) {\n  run();\n}\n";
  assert.ok(!messages(code, "javascript").some((message) => message.includes("Loose equality")));
});

test("assignment inside a JavaScript condition is flagged", () => {
  const code = "let a = 1;\nif (a = 2) {\n  run();\n}\n";
  assert.ok(messages(code, "javascript").some((message) => message.includes("Assignment inside a condition")));
});

test("debugger statement is flagged", () => {
  const code = "function f() {\n  debugger;\n}\n";
  assert.ok(messages(code, "javascript").some((message) => message.includes("debugger")));
});

test("valid JSON has no findings", () => {
  assert.deepEqual(jsonFindings('{"a": 1, "b": [true, null]}'), []);
});

test("invalid JSON reports the parser message", () => {
  const findings = jsonFindings('{"a": 1,}');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, "error");
  assert.match(findings[0].message, /^Invalid JSON:/);
});

test("findings point inside the document", () => {
  const code = "import os\n";
  for (const finding of heuristicFindings(code, "python")) {
    assert.ok(finding.from >= 0);
    assert.ok(finding.to <= code.length);
    assert.ok(finding.to > finding.from);
  }
});

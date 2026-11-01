/**
 * Code analysis: parser errors plus a small, honest set of language-aware
 * checks. Nothing here claims to type-check; every message names the rule that
 * fired, and the range points at the text that caused it.
 */

export type Severity = "error" | "warning" | "info";

export type Finding = {
  from: number;
  to: number;
  severity: Severity;
  message: string;
};

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function offsetOf(starts: number[], line: number, column: number): number {
  return (starts[line] ?? 0) + column;
}

function clampRange(from: number, to: number, length: number): { from: number; to: number } {
  const start = Math.max(0, Math.min(from, length));
  const end = Math.max(start + 1, Math.min(to, length));
  return { from: start, to: end };
}

/** Tabs and spaces mixed in one indentation are a Python syntax error waiting to happen. */
function mixedIndentation(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    const indent = line.match(/^[ \t]+/)?.[0] ?? "";
    if (indent.includes("\t") && indent.includes(" ")) {
      findings.push({
        ...clampRange(offsetOf(starts, index, 0), offsetOf(starts, index, indent.length), text.length),
        severity: "warning",
        message: "Tabs and spaces are mixed in this indentation.",
      });
    }
  });

  return findings;
}

function pythonUnusedImports(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const simple = line.match(/^(\s*)import\s+([a-zA-Z_][\w.]*)(?:\s+as\s+([a-zA-Z_]\w*))?\s*$/);
    const fromImport = line.match(/^(\s*)from\s+[\w.]+\s+import\s+(.+)$/);

    const names: string[] = [];
    if (simple) names.push(simple[3] ?? simple[2].split(".")[0]);
    if (fromImport && !fromImport[2].includes("*")) {
      for (const piece of fromImport[2].split(",")) {
        const name = piece.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && /^[A-Za-z_]\w*$/.test(name)) names.push(name);
      }
    }
    if (names.length === 0) return;

    const rest = lines.filter((_, other) => other !== index).join("\n");
    for (const name of names) {
      const used = new RegExp(`\\b${name}\\b`).test(rest);
      if (!used) {
        findings.push({
          ...clampRange(offsetOf(starts, index, 0), offsetOf(starts, index, line.length), text.length),
          severity: "warning",
          message: `'${name}' is imported but never used.`,
        });
      }
    }
  });

  return findings;
}

/** `if x = 1:` is almost always a typo for `==`. */
function assignmentInCondition(text: string, starts: number[], language: string | null): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) return;

    let condition: string | null = null;
    let offsetInLine = 0;

    if (language === "python") {
      const match = line.match(/^(\s*)(?:if|elif|while)\b(.*)$/);
      if (match) {
        condition = match[2];
        offsetInLine = match[1].length + line.trimStart().split(/\s+/)[0].length;
      }
    } else if (language) {
      const match = line.match(/\b(?:if|while)\s*\(([^)]*)\)/);
      if (match) {
        condition = match[1];
        offsetInLine = line.indexOf(match[1]);
      }
    }

    if (condition === null) return;

    const assignment = condition.match(/(?<![=!<>:+\-*/%&|^])=(?!=)/);
    if (!assignment) return;

    const at = offsetInLine + (assignment.index ?? 0);
    findings.push({
      ...clampRange(offsetOf(starts, index, at), offsetOf(starts, index, at + 1), text.length),
      severity: "warning",
      message: "Assignment inside a condition; use '==' to compare.",
    });
  });

  return findings;
}

function pythonComparisons(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const pattern = /(?:==|!=)\s*(?:None|True|False)\b|\b(?:None|True|False)\s*(?:==|!=)/;
    const match = line.match(pattern);
    if (!match) return;

    const from = offsetOf(starts, index, match.index ?? 0);
    findings.push({
      ...clampRange(from, from + match[0].length, text.length),
      severity: "warning",
      message: "Compare with None/True/False using 'is' or 'is not'.",
    });
  });

  return findings;
}

function pythonBareExcept(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    if (!/^\s*except\s*:/.test(line)) return;
    findings.push({
      ...clampRange(offsetOf(starts, index, 0), offsetOf(starts, index, line.length), text.length),
      severity: "warning",
      message: "Bare 'except:' also catches KeyboardInterrupt and SystemExit; catch a specific error.",
    });
  });

  return findings;
}

function pythonMutableDefault(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    if (!/^\s*(?:async\s+)?def\s+\w+\(/.test(line)) return;
    const match = line.match(/=\s*(\[|\{)/);
    if (!match) return;

    const at = (match.index ?? 0) + match[0].indexOf(match[1]);
    findings.push({
      ...clampRange(offsetOf(starts, index, at), offsetOf(starts, index, at + 1), text.length),
      severity: "warning",
      message: "Mutable default argument; use None and build it inside the function.",
    });
  });

  return findings;
}

function javascriptLooseEquality(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return;

    const match = line.match(/[^=!<>](==|!=)[^=]/);
    if (!match) return;

    const at = (match.index ?? 0) + 1;
    findings.push({
      ...clampRange(offsetOf(starts, index, at), offsetOf(starts, index, at + 2), text.length),
      severity: "warning",
      message: `Loose equality (${match[1]}); prefer ${match[1] === "==" ? "===" : "!=="}.`,
    });
  });

  return findings;
}

function javascriptDebugger(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];

  text.split("\n").forEach((line, index) => {
    const match = line.match(/^\s*debugger\s*;?\s*$/);
    if (!match) return;
    findings.push({
      ...clampRange(offsetOf(starts, index, 0), offsetOf(starts, index, line.length), text.length),
      severity: "warning",
      message: "A 'debugger' statement is left in the file.",
    });
  });

  return findings;
}

/** JSON has a real parser, so use its message instead of a grammar guess. */
export function jsonFindings(text: string): Finding[] {
  if (!text.trim()) return [];

  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const position = Number(message.match(/at position (\d+)/)?.[1] ?? 0);
    const cleaned = message
      .replace(/\s*in JSON at position \d+.*$/i, "")
      .replace(/^JSON\.parse:\s*/i, "")
      .trim();

    return [
      {
        ...clampRange(position, position + 1, text.length),
        severity: "error",
        message: `Invalid JSON: ${cleaned}`,
      },
    ];
  }
}

export function heuristicFindings(text: string, language: string | null): Finding[] {
  if (!text) return [];

  const starts = lineStarts(text);
  const findings: Finding[] = [...mixedIndentation(text, starts)];

  if (language === "python") {
    findings.push(
      ...pythonUnusedImports(text, starts),
      ...assignmentInCondition(text, starts, language),
      ...pythonComparisons(text, starts),
      ...pythonBareExcept(text, starts),
      ...pythonMutableDefault(text, starts),
    );
  }

  if (language === "javascript" || language === "typescript" || language === "java" || language === "cpp") {
    findings.push(
      ...assignmentInCondition(text, starts, language),
      ...javascriptLooseEquality(text, starts),
      ...javascriptDebugger(text, starts),
    );
  }

  return findings;
}

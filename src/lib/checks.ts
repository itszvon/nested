/**
 * Extra checks layered on top of the parser's own syntax errors.
 *
 * These are heuristics with a narrow, honest scope. They are not a type
 * checker and never pretend to be: each diagnostic states exactly what rule
 * fired.
 */

export type Finding = {
  from: number;
  to: number;
  severity: "warning" | "error";
  message: string;
};

function lineStarts(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetOf(starts: number[], line: number, column: number) {
  const base = starts[line] ?? 0;
  return base + column;
}

/** Tabs and spaces mixed in one indentation are a Python syntax error waiting to happen. */
function mixedIndentation(text: string, starts: number[]): Finding[] {
  const findings: Finding[] = [];
  text.split("\n").forEach((line, index) => {
    const indent = line.match(/^[ \t]+/)?.[0] ?? "";
    if (indent.includes("\t") && indent.includes(" ")) {
      findings.push({
        from: offsetOf(starts, index, 0),
        to: offsetOf(starts, index, indent.length),
        severity: "warning",
        message: "Tabs and spaces mixed in the same indentation.",
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
          from: offsetOf(starts, index, 0),
          to: offsetOf(starts, index, line.length),
          severity: "warning",
          message: `'${name}' is imported but never used.`,
        });
      }
    }
  });

  return findings;
}

export function heuristicFindings(text: string, language: string | null): Finding[] {
  if (!text) return [];
  const starts = lineStarts(text);
  const findings: Finding[] = [...mixedIndentation(text, starts)];

  if (language === "python") {
    findings.push(...pythonUnusedImports(text, starts));
  }

  return findings;
}

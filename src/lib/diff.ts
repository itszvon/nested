/**
 * Line diff, pure so it can be tested without a browser.
 *
 * Removed and added runs are paired row by row, so a changed line shows the old
 * text on the left and the new text on the right rather than two blocks.
 */

import { diffLines } from "diff";

export type DiffRow = {
  left: string | null;
  right: string | null;
  leftNo: number | null;
  rightNo: number | null;
  kind: "same" | "add" | "del" | "change";
};

export const MAX_DIFF_ROWS = 4000;

function splitLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function buildDiffRows(
  left: string,
  right: string,
): { rows: DiffRow[]; truncated: boolean } {
  const rows: DiffRow[] = [];
  let leftNumber = 1;
  let rightNumber = 1;
  let pending: string[] = [];
  let truncated = false;

  function push(leftLine: string | null, rightLine: string | null) {
    if (rows.length >= MAX_DIFF_ROWS) {
      truncated = true;
      return;
    }
    rows.push({
      left: leftLine,
      right: rightLine,
      leftNo: leftLine === null ? null : leftNumber++,
      rightNo: rightLine === null ? null : rightNumber++,
      kind:
        leftLine === null
          ? "add"
          : rightLine === null
            ? "del"
            : leftLine === rightLine
              ? "same"
              : "change",
    });
  }

  for (const part of diffLines(left, right)) {
    const lines = splitLines(part.value);

    if (part.removed) {
      pending.push(...lines);
      continue;
    }

    if (part.added) {
      const count = Math.max(pending.length, lines.length);
      for (let index = 0; index < count; index++) {
        push(pending[index] ?? null, lines[index] ?? null);
      }
      pending = [];
      continue;
    }

    // Removals followed by untouched lines must be emitted before them.
    for (const line of pending) push(line, null);
    pending = [];

    for (const line of lines) push(line, line);
  }

  for (const line of pending) push(line, null);

  return { rows, truncated };
}

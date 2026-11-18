import { EditorSelection } from "@codemirror/state";
import type { EditorView, KeyBinding } from "@codemirror/view";

/**
 * Markdown formatting that writes syntax rather than changing display.
 *
 * The document stays plain Markdown on disk, so version history, diffs and
 * export all keep working. These are the same edits a person would type, just
 * applied to the current selection.
 */

export type MarkdownCommand = "bold" | "italic" | "code" | "h1" | "h2" | "ul";

const WRAPPERS: Record<"bold" | "italic" | "code", readonly [string, string]> = {
  bold: ["**", "**"],
  italic: ["_", "_"],
  code: ["`", "`"],
};

const PREFIXES: Record<"h1" | "h2" | "ul", string> = {
  h1: "# ",
  h2: "## ",
  ul: "- ",
};

function wrap(view: EditorView, before: string, after: string): void {
  const { state } = view;

  const spec = state.changeByRange((range) => {
    const selected = state.sliceDoc(range.from, range.to);

    if (range.empty) {
      return {
        changes: { from: range.from, insert: before + after },
        range: EditorSelection.cursor(range.from + before.length),
      };
    }

    return {
      changes: { from: range.from, to: range.to, insert: before + selected + after },
      range: EditorSelection.range(range.from + before.length, range.to + before.length),
    };
  });

  view.dispatch(spec);
  view.focus();
}

function prefixLines(view: EditorView, prefix: string): void {
  const { state } = view;
  const starts = new Set<number>();

  for (const range of state.selection.ranges) {
    let position = range.from;
    for (;;) {
      const line = state.doc.lineAt(position);
      starts.add(line.from);
      if (line.to >= range.to) break;
      position = line.to + 1;
    }
  }

  const changes = [...starts].map((from) => {
    const line = state.doc.lineAt(from);
    return line.text.startsWith(prefix)
      ? { from: line.from, to: line.from + prefix.length, insert: "" }
      : { from: line.from, insert: prefix };
  });

  if (changes.length === 0) return;
  view.dispatch({ changes });
  view.focus();
}

export function applyMarkdown(view: EditorView, command: MarkdownCommand): void {
  if (command === "bold" || command === "italic" || command === "code") {
    const [before, after] = WRAPPERS[command];
    wrap(view, before, after);
    return;
  }

  prefixLines(view, PREFIXES[command]);
}

export const markdownKeymap: KeyBinding[] = [
  {
    key: "Mod-b",
    run: (view) => {
      applyMarkdown(view, "bold");
      return true;
    },
  },
  {
    key: "Mod-i",
    run: (view) => {
      applyMarkdown(view, "italic");
      return true;
    },
  },
];

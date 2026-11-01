"use client";

import { useEffect, useRef } from "react";
import { Compartment, EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { tags } from "@lezer/highlight";
import {
  diagnosticCount,
  lintGutter,
  linter,
  type Diagnostic,
} from "@codemirror/lint";
import { StreamLanguage, language, syntaxTree } from "@codemirror/language";
import { heuristicFindings } from "@/lib/checks";
import type { EditorSettings } from "@/lib/settings";

// One-dark paints plain strings cyan once the Python grammar tags them as
// special(string), which reads as "not a string" next to f-strings. Every
// string-like tag is pinned to the same green, whichever grammar is loaded.
const greenStrings = HighlightStyle.define([
  {
    tag: [
      tags.string,
      tags.special(tags.string),
      tags.character,
      tags.docString,
      tags.processingInstruction,
      tags.inserted,
    ],
    color: "#98c379",
  },
]);

// The Python grammar tags an f-string's body as `operator`, so one-dark paints
// it cyan while ordinary strings are green. Marking the whole FormatString (the
// prefix, quotes, text and every {hole}) and forcing one colour makes the
// literal read exactly like a plain string.
const stringMark = Decoration.mark({ class: "cm-format-string" });

function buildReplacementDecorations(view: EditorView): DecorationSet {
  const ranges: Array<{ from: number; to: number }> = [];
  const seen = new Set<string>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "FormatString" && node.name !== "ContinuedString") return;
        const key = `${node.from}:${node.to}`;
        if (seen.has(key)) return;
        seen.add(key);
        ranges.push({ from: node.from, to: node.to });
      },
    });
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const range of ranges) builder.add(range.from, range.to, stringMark);
  return builder.finish();
}

// Indent guides: one faint rule per tab stop of leading whitespace. Drawn as a
// background on the line so it costs no DOM nodes. `ch` units keep it aligned
// with the monospace face at any font size.
function indentDecorations(view: EditorView, tabSize: number): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = view.state.doc.lineAt(position);
      let columns = 0;

      for (const character of line.text) {
        if (character === " ") columns += 1;
        else if (character === "\t") columns += tabSize - (columns % tabSize);
        else break;
      }

      if (columns > 0) {
        const style =
          "background-image: repeating-linear-gradient(to right, rgba(255,255,255,0.07) 0 1px, transparent 1px " +
          tabSize +
          "ch); background-size: " +
          columns +
          "ch 100%; background-repeat: no-repeat;";
        builder.add(line.from, line.from, Decoration.line({ attributes: { style } }));
      }

      if (line.to + 1 > to) break;
      position = line.to + 1;
    }
  }

  return builder.finish();
}

function indentGuides(tabSize: number) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = indentDecorations(view, tabSize);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = indentDecorations(update.view, tabSize);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

// Rainbow brackets: depth is counted from the syntax tree, so brackets inside
// strings and comments are never coloured. Three colours cycle.
function bracketDecorations(view: EditorView): DecorationSet {
  const found: Array<{ from: number; to: number; depth: number }> = [];
  const tree = syntaxTree(view.state);
  let depth = 0;

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (node.to - node.from !== 1) return;
        const character = view.state.doc.sliceString(node.from, node.to);

        if (character === "(" || character === "[" || character === "{") {
          found.push({ from: node.from, to: node.to, depth });
          depth += 1;
        } else if (character === ")" || character === "]" || character === "}") {
          depth = Math.max(0, depth - 1);
          found.push({ from: node.from, to: node.to, depth });
        }
      },
    });
  }

  found.sort((a, b) => a.from - b.from);

  const builder = new RangeSetBuilder<Decoration>();
  for (const item of found) {
    builder.add(
      item.from,
      item.to,
      Decoration.mark({ class: `cm-bracket-${(item.depth % 3) + 1}` }),
    );
  }
  return builder.finish();
}

const bracketColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = bracketDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.facet(language) !== update.state.facet(language)
      ) {
        this.decorations = bracketDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const fStringReplacements = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildReplacementDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild when the grammar changes too: the language is imported lazily,
      // so the first build can run before f-strings can be recognised.
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.facet(language) !== update.state.facet(language)
      ) {
        this.decorations = buildReplacementDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function makeTheme(fontSize: number) {
  return EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--color-ink)",
      height: "100%",
      fontSize: `${fontSize}px`,
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.65",
      overflow: "auto",
    },
    ".cm-content": {
      padding: "12px 0 45vh 0",
      caretColor: "var(--color-accent)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--color-ink-faint)",
      border: "none",
      paddingRight: "4px",
    },
    // Higher specificity than the highlight classes, so the prefix, quotes,
    // text and every interpolation hole stay string-green.
    ".cm-format-string, .cm-format-string *": { color: "#98c379 !important" },
    ".cm-bracket-1": { color: "#e5c07b" },
    ".cm-bracket-2": { color: "#56b6c2" },
    ".cm-bracket-3": { color: "#c678dd" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.025)" },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-ink-dim)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "rgba(168,68,47,0.32)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-accent)" },
    ".cm-searchMatch": { backgroundColor: "rgba(168,68,47,0.28)" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(168,68,47,0.5)" },
    ".cm-panels": {
      backgroundColor: "var(--color-panel)",
      color: "var(--color-ink)",
      borderColor: "var(--color-rule)",
    },
    ".cm-panels input, .cm-panels button": {
      backgroundColor: "var(--color-ground)",
      color: "var(--color-ink)",
      border: "1px solid var(--color-rule)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--color-panel)",
      border: "1px solid var(--color-rule-strong)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--color-accent-dim)",
      color: "var(--color-ink)",
    },
  },
  { dark: true },
  );
}

async function loadLanguage(language: string | null): Promise<Extension[]> {
  switch (language) {
    case "python":
      return [(await import("@codemirror/lang-python")).python()];
    case "java":
      return [(await import("@codemirror/lang-java")).java()];
    case "javascript":
      return [(await import("@codemirror/lang-javascript")).javascript()];
    case "typescript":
      return [(await import("@codemirror/lang-javascript")).javascript({ typescript: true })];
    case "go":
      return [(await import("@codemirror/lang-go")).go()];
    case "rust":
      return [(await import("@codemirror/lang-rust")).rust()];
    case "sql":
      return [(await import("@codemirror/lang-sql")).sql()];
    case "bash": {
      const [{ StreamLanguage }, { shell }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/shell"),
      ]);
      return [StreamLanguage.define(shell)];
    }
    case "html":
      return [(await import("@codemirror/lang-html")).html()];
    case "css":
      return [(await import("@codemirror/lang-css")).css()];
    case "cpp":
      return [(await import("@codemirror/lang-cpp")).cpp()];
    case "json":
      return [(await import("@codemirror/lang-json")).json()];
    case "yaml":
      return [(await import("@codemirror/lang-yaml")).yaml()];
    default:
      return [];
  }
}

/**
 * Diagnostics come from two sources: the parser's own error nodes, which are
 * real syntax errors for every supported language, and a few narrow
 * heuristics. Nothing here claims to type-check.
 */
function buildLinter(language: string | null) {
  return linter(
    (view) => {
      const text = view.state.doc.toString();
      const diagnostics: Diagnostic[] = [];

      syntaxTree(view.state).iterate({
        enter(node) {
          if (node.type.isError) {
            diagnostics.push({
              from: node.from,
              to: Math.max(node.to, node.from + 1),
              severity: "error",
              message: "Syntax error",
            });
          }
        },
      });

      for (const finding of heuristicFindings(text, language)) {
        diagnostics.push(finding);
      }

      return diagnostics;
    },
    { delay: 400 },
  );
}

export function CodeEditor({
  kind,
  language,
  initialText,
  settings,
  onChange,
  onView,
  onDiagnostics,
}: {
  kind: "markdown" | "code";
  language: string | null;
  initialText: string;
  settings: EditorSettings;
  onChange: (text: string) => void;
  onView: (view: EditorView | null) => void;
  onDiagnostics?: (count: number) => void;
}) {  
  const host = useRef<HTMLDivElement>(null);
  const languageSlot = useRef(new Compartment());
  const changeHandler = useRef(onChange);
  const diagnosticsHandler = useRef(onDiagnostics);

  // Mirror the latest props after paint; the editor's listeners read them.
  useEffect(() => {
    changeHandler.current = onChange;
    diagnosticsHandler.current = onDiagnostics;
  });

  useEffect(() => {
    if (!host.current) return;

    const isCode = kind === "code";

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        history({ minDepth: 1000, newGroupDelay: 400 }),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(oneDarkHighlightStyle),
        syntaxHighlighting(greenStrings),
        fStringReplacements,
        ...(isCode ? [indentGuides(settings.tabSize), bracketColors] : []),
        makeTheme(settings.fontSize),
        EditorState.tabSize.of(settings.tabSize),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        // Text files are plain: wrapping on, no gutter, no folding, no
        // highlighting. Code files get the full instrument panel.
        ...(isCode
          ? [
              ...(settings.lineNumbers ? [lineNumbers()] : []),
              highlightActiveLineGutter(),
              foldGutter(),
            ]
          : [EditorView.lineWrapping]),
        ...(settings.wordWrap ? [EditorView.lineWrapping] : []),
        ...(isCode ? [lintGutter(), buildLinter(language)] : []),
        languageSlot.current.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changeHandler.current(update.state.doc.toString());
          if (diagnosticsHandler.current) {
            diagnosticsHandler.current(diagnosticCount(update.state));
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: host.current });
    onView(view);

    // Language packs are large; load only the one this file needs.
    if (isCode && language) {
      let cancelled = false;
      void loadLanguage(language).then((extensions) => {
        if (cancelled) return;
        view.dispatch({
          effects: languageSlot.current.reconfigure(extensions),
        });
      });
      return () => {
        cancelled = true;
        onView(null);
        view.destroy();
      };
    }

    return () => {
      onView(null);
      view.destroy();
    };
    // The parent remounts with a new key per file, so this runs once per file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="h-full overflow-hidden" />;
}

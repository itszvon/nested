"use client";

import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
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
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import {
  diagnosticCount,
  lintGutter,
  linter,
  type Diagnostic,
} from "@codemirror/lint";
import { StreamLanguage, syntaxTree } from "@codemirror/language";
import { heuristicFindings } from "@/lib/checks";
import type { EditorSettings } from "@/lib/settings";

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
  changeHandler.current = onChange;
  const diagnosticsHandler = useRef(onDiagnostics);
  diagnosticsHandler.current = onDiagnostics;

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

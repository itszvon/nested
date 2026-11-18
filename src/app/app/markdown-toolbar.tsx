"use client";

import type { EditorView } from "@codemirror/view";
import { applyMarkdown, type MarkdownCommand } from "@/lib/markdown-format";

/**
 * Formatting strip for Markdown files.
 *
 * Buttons write Markdown syntax at the cursor or around the selection, so the
 * stored file stays plain text and every other feature (versions, diff,
 * export) keeps working unchanged.
 */

type Tool = { command: MarkdownCommand; label: string; title: string; className?: string };

const TOOLS: Tool[] = [
  { command: "bold", label: "B", title: "Bold (Ctrl+B)", className: "font-semibold" },
  { command: "italic", label: "I", title: "Italic (Ctrl+I)", className: "italic" },
  { command: "h1", label: "H1", title: "Heading 1" },
  { command: "h2", label: "H2", title: "Heading 2" },
  { command: "ul", label: "•", title: "Bulleted list" },
  { command: "code", label: "`", title: "Inline code", className: "font-mono" },
];

export function MarkdownToolbar({ getView }: { getView: () => EditorView | null }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b border-rule bg-panel/50 px-2">
      <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
        markdown
      </span>
      {TOOLS.map((tool) => (
        <button
          key={tool.command}
          type="button"
          title={tool.title}
          aria-label={tool.title}
          onClick={() => {
            const view = getView();
            if (view) applyMarkdown(view, tool.command);
          }}
          className={[
            "grid h-6 min-w-6 place-items-center border border-transparent px-1.5 font-mono text-[11px] text-ink-dim",
            "hover:border-rule-strong hover:text-ink focus-visible:border-accent focus-visible:text-ink focus-visible:outline-none",
            tool.className ?? "",
          ].join(" ")}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { redo, undo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import type { OpenFile } from "@/lib/files";
import type { FileRow } from "@/lib/tree";
import { deleteDraft, getDraft, putDraft, type Draft } from "@/lib/drafts";
import {
  buffersInProject,
  deleteBuffer,
  getBuffer,
  setBuffer,
} from "@/lib/buffers";
import { formatCode, FORMATTABLE } from "@/lib/format";
import { languageLabel, languageStatus } from "@/lib/languages";
import type { EditorSettings } from "@/lib/settings";
import { RUNNER_ENABLED } from "@/lib/site";
import { removeBlankLines, tidyBlankLines } from "@/lib/whitespace";
import { getFileSnapshot, saveFile, saveProject, type SaveProjectItem } from "./actions";
import { Modal, NotesDialog, SaveProjectDialog, VersionHistoryDialog } from "./dialogs";
import { RunnerPanel } from "./runner";
import type { EditorIssue } from "./editor";

const CodeEditor = dynamic(() => import("./editor").then((module) => module.CodeEditor), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-3 font-mono text-[11px] text-ink-faint">loading editor</div>
  ),
});

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Which pane owns Ctrl+S / Ctrl+Enter when two are open. Updated by pointer
// and focus, so the split view cannot save both files at once.
let activePane: string | null = null;

/**
 * Where the open file lives. Folder segments jump to that row in the tree;
 * the file itself is the current location, so it is not a button. Long paths
 * drop their middle without losing the full path in the tooltip.
 */
function FileBreadcrumb({
  path,
  fileName,
  children,
}: {
  path: Array<{ id: string; name: string }>;
  fileName: string;
  children?: React.ReactNode;
}) {
  type Segment =
    | { kind: "folder"; id: string; name: string }
    | { kind: "file"; name: string }
    | { kind: "ellipsis"; names: string[] };

  const fullPath = [...path.map((part) => part.name), fileName].join(" / ");
  let segments: Segment[];

  if (path.length <= 2) {
    segments = [
      ...path.map((part): Segment => ({ kind: "folder", id: part.id, name: part.name })),
      { kind: "file", name: fileName },
    ];
  } else {
    segments = [
      { kind: "folder", id: path[0].id, name: path[0].name },
      { kind: "ellipsis", names: path.slice(1, -1).map((part) => part.name) },
      { kind: "folder", id: path[path.length - 1].id, name: path[path.length - 1].name },
      { kind: "file", name: fileName },
    ];
  }

  return (
    <nav
      aria-label="File location"
      title={fullPath}
      className="flex h-7 shrink-0 items-center gap-1 overflow-hidden border-b border-rule px-4 font-mono text-[10px] text-ink-faint"
    >
      {segments.map((segment, index) => (
        <span key={index} className="flex min-w-0 items-center gap-1">
          {index > 0 ? (
            <span aria-hidden="true" className="shrink-0 text-ink-faint/60">
              /
            </span>
          ) : null}

          {segment.kind === "folder" ? (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("nested:reveal", { detail: segment.id }))
              }
              title={`Reveal ${segment.name} in the tree`}
              className="truncate hover:text-ink"
            >
              {segment.name}
            </button>
          ) : segment.kind === "ellipsis" ? (
            <span
              title={segment.names.join(" / ")}
              className="shrink-0 cursor-default text-ink-faint"
            >
              …
            </span>
          ) : (
            <span className="truncate text-ink-dim">{segment.name}</span>
          )}
        </span>
      ))}

      {children ? (
        <span className="ml-auto flex shrink-0 items-center gap-2 pl-2">{children}</span>
      ) : null}
    </nav>
  );
}

function CompareDialog({
  files,
  currentId,
  onClose,
  onPick,
}: {
  files: FileRow[];
  currentId: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const options = files
    .filter((candidate) => candidate.id !== currentId)
    .filter((candidate) => !needle || candidate.name.toLowerCase().includes(needle))
    .slice(0, 30);

  return (
    <Modal title="Compare with" onClose={onClose}>
      <div className="p-3">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="File name"
          aria-label="Find a file to compare with"
          className="h-8 w-full border border-rule bg-ground px-2 text-[12px] text-ink outline-none focus:border-accent"
        />

        <div className="mt-2 max-h-64 overflow-auto">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-ink-faint">Nothing matches.</p>
          ) : (
            options.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => onPick(candidate.id)}
                className="block w-full truncate px-2 py-1.5 text-left text-[12px] text-ink-dim hover:bg-[#161b18] hover:text-ink"
              >
                {candidate.name}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

export function FilePane({
  file,
  userId,
  settings,
  openVersions = false,
  isPrimary = true,
  path = [],
  files = [],
  initialLine,
}: {
  file: OpenFile;
  userId: string;
  settings: EditorSettings;
  openVersions?: boolean;
  isPrimary?: boolean;
  path?: Array<{ id: string; name: string }>;
  files?: FileRow[];
  initialLine?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const cached = getBuffer(file.id);
  const [versionsOpen, setVersionsOpen] = useState(openVersions);
  const [saveProjectOpen, setSaveProjectOpen] = useState(false);
  const [runner, setRunner] = useState<{ code: string; runId: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState<EditorIssue[]>([]);
  const [checksOpen, setChecksOpen] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  // Saving asks for the version name, so history reads like a changelog.
  const [saveDialog, setSaveDialog] = useState(false);
  const [versionName, setVersionName] = useState("");

  // "Version history" arrives as ?versions=1 from the tree menu. Consume it and
  // clean the URL, so the same menu item works again after closing.
  useEffect(() => {
    if (!openVersions) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVersionsOpen(true);
    const params = new URLSearchParams(window.location.search);
    params.delete("versions");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [openVersions, file.id, pathname, router]);

  const [text, setText] = useState(cached?.text ?? file.content);
  const [savedText, setSavedText] = useState(file.content);
  const [revision, setRevision] = useState(cached?.baseRevision ?? file.revision);
  const [savedAt, setSavedAt] = useState(file.updated_at);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const viewRef = useRef<EditorView | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const dirty = text !== savedText;

  // The tab strip draws its dot from this, without lifting editor state.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("nested:dirty", { detail: { id: file.id, dirty } }),
    );
  }, [dirty, file.id]);

  // Look for a draft left behind by a crash. Only offered when it differs from
  // what the server has, so a successful save never nags.
  useEffect(() => {
    if (getBuffer(file.id)) return;

    let cancelled = false;
    void getDraft(userId, file.id).then((found) => {
      if (cancelled || !found) return;
      if (found.text === file.content) {
        void deleteDraft(userId, file.id);
        return;
      }
      setDraft(found);
    });
    return () => {
      cancelled = true;
    };
  }, [file.id, file.content, userId]);

  const scheduleDraft = useCallback(
    (next: string) => {
      if (draftTimer.current) clearTimeout(draftTimer.current);

      if (next === savedText) {
        void deleteDraft(userId, file.id);
        return;
      }

      draftTimer.current = setTimeout(() => {
        void putDraft(userId, file.id, {
          text: next,
          savedAt: Date.now(),
          baseRevision: revision,
        });
      }, 500);
    },
    [file.id, revision, savedText, userId],
  );

  function handleChange(next: string) {
    setText(next);
    scheduleDraft(next);
  }

  function jumpToIssue(issue: EditorIssue) {
    const view = viewRef.current;
    if (!view) return;

    const from = Math.min(issue.from, view.state.doc.length);
    const to = Math.min(Math.max(issue.to, from), view.state.doc.length);
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    view.focus();
  }

  function jumpToLine(lineNumber: number) {
    const view = viewRef.current;
    if (!view) return;

    const target = Math.min(Math.max(1, Math.floor(lineNumber)), view.state.doc.lines);
    const line = view.state.doc.line(target);
    view.dispatch({
      selection: { anchor: line.from, head: line.to },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }

  async function copyLink() {
    const view = viewRef.current;
    const line = view ? view.state.doc.lineAt(view.state.selection.main.head).number : 1;
    const url = `${window.location.origin}/app?f=${file.id}&line=${line}`;

    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1200);
    } catch {
      setError("The browser refused clipboard access.");
    }
  }

  // A ?line= link opens the file with that line selected and centred.
  useEffect(() => {
    if (!viewReady || !initialLine) return;
    jumpToLine(initialLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewReady, initialLine]);

  function requestSave() {
    if (saving) return;
    if (textRef.current === savedText) return;
    setVersionName("");
    setSaveDialog(true);
  }

  async function save(label = "") {
    if (saving) return;
    const value = textRef.current;
    if (value === savedText) return;

    setSaving(true);
    setError(null);

    const result = await saveFile(file.id, value, revision, label);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      if (/changed somewhere else/i.test(result.error)) setConflict(true);
      return;
    }

    setConflict(false);
    setSavedText(value);
    setRevision(result.revision);
    setSavedAt(new Date().toISOString());
    deleteBuffer(file.id);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    await deleteDraft(userId, file.id);
    router.refresh();
  }

  // Ctrl/Cmd+S saves instead of opening the browser's save dialog.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (activePane !== null && activePane !== file.id) return;
      if (activePane === null && !isPrimary) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        requestSave();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        setGotoValue("");
        setGotoOpen(true);
      }
      if (RUNNER_ENABLED && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        setRunner({ code: textRef.current, runId: Date.now() });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Warn before losing an unsaved buffer.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Keep the buffer when switching files, and flush the draft on the way out.
  useEffect(() => {
    const id = file.id;
    return () => {
      const value = textRef.current;
      const entry = getBuffer(id);
      if (value !== savedText) {
        setBuffer(id, { text: value, baseRevision: revision, projectId: file.project_id });
        void putDraft(userId, id, { text: value, savedAt: Date.now(), baseRevision: revision });
      } else if (entry) {
        deleteBuffer(id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, savedText, revision, userId]);

  const projectDirtyCount = file.project_id
    ? (dirty ? 1 : 0) +
      buffersInProject(file.project_id).filter(([id]) => id !== file.id).length
    : 0;

  /**
   * Saves every dirty file in this project plus the open buffer as one
   * snapshot. Files elsewhere are deliberately left alone.
   */
  async function saveProjectNow(message: string) {
    if (!file.project_id) return;

    const items: SaveProjectItem[] = [];
    if (dirty) {
      items.push({ fileId: file.id, content: textRef.current, expectedRevision: revision });
    }
    for (const [id, buffer] of buffersInProject(file.project_id)) {
      if (id === file.id) continue;
      items.push({ fileId: id, content: buffer.text, expectedRevision: buffer.baseRevision });
    }
    if (items.length === 0) return;

    const result = await saveProject(file.project_id, message, items);
    if (!result.ok) throw new Error(result.error);

    for (const item of items) {
      if (item.fileId !== file.id) deleteBuffer(item.fileId);
    }

    if (dirty) {
      setSavedText(textRef.current);
      // save_project writes exactly one revision per included file.
      setRevision((current) => current + 1);
      setSavedAt(new Date().toISOString());
      await deleteDraft(userId, file.id);
    }

    setSaveProjectOpen(false);
    router.refresh();
  }

  /** Take the server's copy, throwing away the local buffer. */
  async function reloadTheirCopy() {
    const snapshot = await getFileSnapshot(file.id);
    if (!snapshot.ok) {
      setError(snapshot.error);
      return;
    }
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: snapshot.content },
      });
    }
    setText(snapshot.content);
    setSavedText(snapshot.content);
    setRevision(snapshot.revision);
    setConflict(false);
    setError(null);
  }

  /** Overwrite the server with the local buffer, using its own revision. */
  async function keepMine() {
    const snapshot = await getFileSnapshot(file.id);
    if (!snapshot.ok) {
      setError(snapshot.error);
      return;
    }
    setSaving(true);
    const result = await saveFile(file.id, textRef.current, snapshot.revision, "kept local buffer");
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setRevision(result.revision);
    setSavedText(textRef.current);
    setSavedAt(new Date().toISOString());
    setConflict(false);
    setError(null);
    await deleteDraft(userId, file.id);
    router.refresh();
  }

  async function runFormatter() {
    const view = viewRef.current;
    if (!view || !file.language) return;

    setFormatting(true);
    setError(null);
    try {
      const formatted = await formatCode(file.language, view.state.doc.toString());
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setFormatting(false);
    }
  }

  /** Replaces the whole document in one transaction, so one undo puts it back. */
  function transform(next: (value: string) => string) {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    const result = next(current);
    if (result === current) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: result },
    });
  }

  function restoreDraft() {
    if (!draft || !viewRef.current) {
      setDraft(null);
      return;
    }
    const view = viewRef.current;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: draft.text },
    });
    setDraft(null);
  }

  async function discardDraft() {
    setDraft(null);
    await deleteDraft(userId, file.id);
  }

  const size = new TextEncoder().encode(text).length;

  return (
    <div
      className="flex min-w-0 flex-1 flex-col"
      onPointerDown={() => {
        activePane = file.id;
      }}
      onFocusCapture={() => {
        activePane = file.id;
      }}
    >
      <FileBreadcrumb path={path} fileName={file.name}>
        <button
          type="button"
          onClick={() => void copyLink()}
          title="Copy a link to the current line"
          className="border border-rule px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule-strong hover:text-ink"
        >
          {linkCopied ? "copied" : "link"}
        </button>
        <a
          href={`/api/files/${file.id}/download`}
          title="Download this file"
          className="border border-rule px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule-strong hover:text-ink"
        >
          download
        </a>
      </FileBreadcrumb>

      <div className="flex h-11 shrink-0 items-center gap-3 overflow-hidden border-b border-rule px-4">
        <span className="flex min-w-0 items-center gap-1.5">
          {dirty ? (
            <span
              aria-label="unsaved changes"
              className="h-1.5 w-1.5 shrink-0 bg-accent"
            />
          ) : null}
          <span className="truncate text-[13px] text-ink">{file.name}</span>
        </span>

        <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint md:inline">
          {file.kind === "code"
            ? `${languageLabel(file.language)}${languageStatus(file.language) === "external" ? " / external" : ""}`
            : "text"}
        </span>
        <span className="hidden shrink-0 font-mono text-[10px] text-ink-faint md:inline">
          rev {revision}
        </span>
        <span className="hidden shrink-0 font-mono text-[10px] text-ink-faint lg:inline">
          {size} B
        </span>
        <span className="hidden shrink-0 font-mono text-[10px] text-ink-faint lg:inline">
          {dirty ? "unsaved" : timeOf(savedAt)}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => viewRef.current && undo(viewRef.current)}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="h-7 w-7 border border-transparent font-mono text-[12px] text-ink-faint hover:border-rule hover:text-ink"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => viewRef.current && redo(viewRef.current)}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            className="h-7 w-7 border border-transparent font-mono text-[12px] text-ink-faint hover:border-rule hover:text-ink"
          >
            ↷
          </button>

          {file.kind === "code" && file.language && FORMATTABLE.has(file.language) ? (
            <button
              type="button"
              onClick={() => void runFormatter()}
              disabled={formatting}
              title="Format this file"
              className="ml-1 h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink disabled:opacity-40"
            >
              {formatting ? "..." : "format"}
            </button>
          ) : null}

          {file.kind === "code" ? (
            <>
              <button
                type="button"
                onClick={() => transform((value) => tidyBlankLines(value, file.language))}
                title="Remove redundant blank lines, keep the ones between blocks"
                className="ml-1 h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
              >
                tidy
              </button>
              <button
                type="button"
                onClick={() => transform(removeBlankLines)}
                title="Remove every blank line"
                className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
              >
                flat
              </button>
            </>
          ) : null}

          {file.kind === "code" ? (
            <button
              type="button"
              onClick={() => {
                setChecksOpen((open) => !open);
              }}
              title="Show problems (syntax errors and a few checks)"
              className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
            >
              checks{diagnostics.length > 0 ? ` ${diagnostics.length}` : ""}
            </button>
          ) : null}

          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(textRef.current);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              } catch {
                setError("The browser refused clipboard access.");
              }
            }}
            title="Copy this file to the clipboard"
            className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
          >
            {copied ? "copied" : "copy"}
          </button>

          {file.kind === "code" && RUNNER_ENABLED ? (
            <button
              type="button"
              onClick={() => setRunner({ code: textRef.current, runId: Date.now() })}
              title="Run (Ctrl/Cmd+Enter)"
              className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
            >
              run
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setVersionsOpen(true)}
            className="ml-1 h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
          >
            versions
          </button>

          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            title="Compare with another file"
            className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
          >
            compare
          </button>

          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            title="Notes for this file"
            className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
          >
            notes
          </button>

          <button
            type="button"
            onClick={requestSave}
            disabled={!dirty || saving}
            className="ml-2 h-7 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:cursor-default disabled:border-rule disabled:bg-transparent disabled:text-ink-faint"
          >
            {saving ? "Saving" : "Save File"}
          </button>
          <button
            type="button"
            onClick={() => setSaveProjectOpen(true)}
            disabled={projectDirtyCount === 0}
            title={
              file.project_id
                ? "Save every changed file in this project"
                : "This file is not in a project"
            }
            className="h-7 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim disabled:opacity-40"
          >
            {projectDirtyCount > 1 ? `Save Project (${projectDirtyCount})` : "Save Project"}
          </button>
        </div>
      </div>

      {conflict ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-rule bg-accent/10 px-4 py-2 text-[11px] text-ink">
          <span className="flex-1">
            This file changed somewhere else. Take their copy, or overwrite it with yours.
          </span>
          <button
            type="button"
            onClick={() => void reloadTheirCopy()}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-[var(--color-accent-text)]"
          >
            reload theirs
          </button>
          <button
            type="button"
            onClick={() => void keepMine()}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-[var(--color-accent-text)]"
          >
            keep mine
          </button>
          <button
            type="button"
            onClick={() => setConflict(false)}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint"
          >
            dismiss
          </button>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 border-b border-rule bg-accent/10 px-4 py-2 text-[11px] text-ink">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {draft ? (
        <div className="flex items-center gap-3 border-b border-rule bg-[#111614] px-4 py-2 text-[11px] text-ink-dim">
          <span className="flex-1">
            Unsaved changes from {timeOf(new Date(draft.savedAt).toISOString())} were recovered
            from this browser.
          </span>
          <button
            type="button"
            onClick={restoreDraft}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-[var(--color-accent-text)]"
          >
            restore
          </button>
          <button
            type="button"
            onClick={() => void discardDraft()}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
          >
            discard
          </button>
        </div>
      ) : null}

      {gotoOpen ? (
        <Modal title="Go to line" onClose={() => setGotoOpen(false)}>
          <div className="space-y-3 p-4">
            <input
              autoFocus
              value={gotoValue}
              onChange={(event) => setGotoValue(event.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setGotoOpen(false);
                  jumpToLine(Number(gotoValue) || 1);
                }
              }}
              inputMode="numeric"
              placeholder="Line number"
              aria-label="Line number"
              className="h-9 w-full border border-rule bg-ground px-3 font-mono text-[13px] text-ink outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGotoOpen(false)}
                className="h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:border-rule-strong hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setGotoOpen(false);
                  jumpToLine(Number(gotoValue) || 1);
                }}
                className="h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
              >
                Go
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {saveDialog ? (
        <Modal title="Name this version" onClose={() => setSaveDialog(false)}>
          <div className="space-y-3 p-4">
            <p className="text-[11px] leading-relaxed text-ink-faint">
              The name shows up in version history. Leave it empty and the save is just
              &quot;saved&quot;.
            </p>
            <input
              autoFocus
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setSaveDialog(false);
                  void save(versionName);
                }
              }}
              placeholder="before refactor"
              maxLength={200}
              aria-label="Version name"
              className="h-9 w-full border border-rule bg-ground px-3 text-[13px] text-ink outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveDialog(false)}
                className="h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:border-rule-strong hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveDialog(false);
                  void save(versionName);
                }}
                className="h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
              >
                Save File
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {compareOpen ? (
        <CompareDialog
          files={files}
          currentId={file.id}
          onClose={() => setCompareOpen(false)}
          onPick={(id) => {
            setCompareOpen(false);
            const params = new URLSearchParams(window.location.search);
            params.set("f", file.id);
            params.set("s", id);
            params.set("diff", "1");
            router.replace(`/app?${params.toString()}`, { scroll: false });
          }}
        />
      ) : null}

      {notesOpen ? (
        <NotesDialog
          kind="file"
          id={file.id}
          name={file.name}
          onClose={() => setNotesOpen(false)}
        />
      ) : null}

      {saveProjectOpen ? (
        <SaveProjectDialog
          fileCount={projectDirtyCount}
          onClose={() => setSaveProjectOpen(false)}
          onSave={saveProjectNow}
        />
      ) : null}

      {versionsOpen ? (
        <VersionHistoryDialog
          fileId={file.id}
          fileName={file.name}
          onClose={() => setVersionsOpen(false)}
          onRestore={(content) => {
            const view = viewRef.current;
            if (view) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: content },
              });
            }
            setVersionsOpen(false);
          }}
        />
      ) : null}

      <div className="min-h-0 flex-1">
        <CodeEditor
          key={file.id}
          kind={file.kind}
          language={file.language}
          initialText={text}
          settings={settings}
          onChange={handleChange}
          onView={(view) => {
            viewRef.current = view;
            setViewReady(true);
          }}
          onDiagnostics={setDiagnostics}
        />
      </div>

      {checksOpen ? (
        <div className="flex max-h-48 shrink-0 flex-col border-t border-rule bg-panel/60">
          <div className="flex h-7 shrink-0 items-center gap-3 border-b border-rule px-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
              checks · {diagnostics.length}
            </span>
            <button
              type="button"
              onClick={() => setChecksOpen(false)}
              className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
            >
              close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto py-1">
            {diagnostics.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-ink-faint">No problems found.</p>
            ) : (
              diagnostics.map((issue, index) => (
                <button
                  key={`${issue.from}:${index}`}
                  type="button"
                  onClick={() => jumpToIssue(issue)}
                  className="flex w-full items-start gap-3 px-3 py-1.5 text-left hover:bg-[#111614]"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[5px] h-1.5 w-1.5 shrink-0 ${
                      issue.severity === "error" ? "bg-red-400" : "bg-amber-300"
                    }`}
                  />
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] text-ink-faint">
                    {issue.line}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-ink-dim">
                    {issue.message}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {runner ? (
        <RunnerPanel
          key={runner.runId}
          language={file.language}
          code={runner.code}
          runId={runner.runId}
          onClose={() => setRunner(null)}
        />
      ) : null}
    </div>
  );
}

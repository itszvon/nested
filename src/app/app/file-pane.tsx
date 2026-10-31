"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import type { OpenFile } from "@/lib/files";
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
import { SaveProjectDialog, VersionHistoryDialog } from "./dialogs";
import { RunnerPanel } from "./runner";
import { openLintPanel } from "@codemirror/lint";

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

export function FilePane({
  file,
  userId,
  settings,
  openVersions = false,
}: {
  file: OpenFile;
  userId: string;
  settings: EditorSettings;
  openVersions?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const cached = getBuffer(file.id);
  const [versionsOpen, setVersionsOpen] = useState(openVersions);
  const [saveProjectOpen, setSaveProjectOpen] = useState(false);
  const [runner, setRunner] = useState<{ code: string; runId: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState(0);
  const [formatting, setFormatting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [copied, setCopied] = useState(false);
  // Optional note stored on the version created by the next save.
  const [note, setNote] = useState("");

  // "Version history" arrives as ?versions=1 from the tree menu. Consume it and
  // clean the URL, so the same menu item works again after closing.
  useEffect(() => {
    if (!openVersions) return;
    setVersionsOpen(true);
    router.replace(`${pathname}?f=${file.id}`, { scroll: false });
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
  textRef.current = text;

  const dirty = text !== savedText;

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

  async function save() {
    if (saving) return;
    const value = textRef.current;
    if (value === savedText) return;

    setSaving(true);
    setError(null);

    const result = await saveFile(file.id, value, revision, note);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      if (/changed somewhere else/i.test(result.error)) setConflict(true);
      return;
    }

    setNote("");
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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
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
    const result = await saveFile(file.id, textRef.current, snapshot.revision, note);
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
    <div className="flex min-w-0 flex-1 flex-col">
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
                if (viewRef.current) openLintPanel(viewRef.current);
              }}
              title="Show problems (syntax errors and a few checks)"
              className="h-7 border border-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule hover:text-ink"
            >
              checks{diagnostics > 0 ? ` ${diagnostics}` : ""}
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

          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              }
            }}
            placeholder="note for this save"
            aria-label="Note for this save"
            maxLength={200}
            className="ml-1 hidden h-7 w-[130px] border border-rule bg-ground px-2 font-mono text-[10px] text-ink outline-none placeholder:text-ink-faint focus:border-accent lg:block"
          />

          <button
            type="button"
            onClick={() => void save()}
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
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-accent"
          >
            reload theirs
          </button>
          <button
            type="button"
            onClick={() => void keepMine()}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-accent"
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
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink hover:text-accent"
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
          }}
          onDiagnostics={setDiagnostics}
        />
      </div>

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

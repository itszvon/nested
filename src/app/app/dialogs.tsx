"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createFile,
  createFolder,
  deleteVersion,
  listSnapshots,
  listVersions,
  restoreProjectSnapshot,
  restoreVersion,
  type FileKind,
  type SnapshotSummary,
  type VersionSummary,
} from "./actions";

const LANGUAGES = [
  { id: "python", label: "Python", ext: "py" },
  { id: "java", label: "Java", ext: "java" },
  { id: "javascript", label: "JavaScript", ext: "js" },
  { id: "htmlcss", label: "HTML/CSS", ext: "html" },
  { id: "cpp", label: "C++", ext: "cpp" },
] as const;

const EXT_LANGUAGE: Record<string, string> = {
  py: "python",
  java: "java",
  js: "javascript",
  html: "html",
  css: "css",
  cpp: "cpp",
  h: "cpp",
  hpp: "cpp",
};

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[18vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[380px] border border-rule-strong bg-panel"
      >
        <div className="border-b border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldClass =
  "h-8 w-full border border-rule bg-ground px-2 text-[13px] text-ink outline-none focus:border-accent";

/** Creates a Markdown or code file. The type is never implicit. */
export function NewFileDialog({
  folderId,
  folderName,
  onClose,
  onCreated,
}: {
  folderId: string | null;
  folderName: string;
  onClose: () => void;
  onCreated: (fileId: string) => void;
}) {
  const [kind, setKind] = useState<FileKind>("markdown");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["id"]>("python");
  const [ext, setExt] = useState("md");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  function chooseKind(next: FileKind) {
    setKind(next);
    setExt(next === "markdown" ? "md" : LANGUAGES.find((l) => l.id === language)?.ext ?? "py");
  }

  function chooseLanguage(id: (typeof LANGUAGES)[number]["id"]) {
    setLanguage(id);
    setExt(LANGUAGES.find((l) => l.id === id)?.ext ?? "py");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const base = name.trim();
    if (!base) {
      setError("Give it a name.");
      return;
    }

    const cleanExt = ext.trim().replace(/^\./, "");
    if (kind === "code" && !cleanExt) {
      setError("Give it an extension.");
      return;
    }

    const fullName = cleanExt ? `${base}.${cleanExt}` : base;

    setBusy(true);
    setError(null);

    const result = await createFile({
      folderId,
      name: fullName,
      kind,
      language: kind === "code" ? EXT_LANGUAGE[cleanExt.toLowerCase()] ?? language : null,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.id) onCreated(result.id);
  }

  return (
    <Modal title={`New file · ${folderName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 p-4">
        <div className="flex gap-2">
          {(["markdown", "code"] as FileKind[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chooseKind(option)}
              aria-pressed={kind === option}
              className={[
                "h-8 flex-1 border font-mono text-[10px] uppercase tracking-[0.12em]",
                kind === option
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-rule text-ink-dim hover:border-rule-strong",
              ].join(" ")}
            >
              {option === "markdown" ? "Text file" : "Code file"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="name"
            aria-label="File name"
            className={fieldClass}
          />
          <span className="font-mono text-[11px] text-ink-faint">.</span>
          <input
            value={ext}
            onChange={(event) => setExt(event.target.value)}
            aria-label="Extension"
            className="h-8 w-16 border border-rule bg-ground px-2 text-[13px] text-ink outline-none focus:border-accent"
          />
        </div>

        {kind === "code" ? (
          <select
            value={language}
            onChange={(event) => chooseLanguage(event.target.value as typeof language)}
            aria-label="Language"
            className={fieldClass}
          >
            {LANGUAGES.map((entry) => (
              <option key={entry.id} value={entry.id} className="bg-panel">
                {entry.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Plain text. No highlighting, no formatting, no preview.
          </p>
        )}

        {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {busy ? "Creating" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewFolderDialog({
  parentId,
  parentName,
  onClose,
  onCreated,
}: {
  parentId: string | null;
  parentName: string;
  onClose: () => void;
  onCreated: (folderId: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError("Give it a name.");
      return;
    }

    setBusy(true);
    setError(null);
    const result = await createFolder(parentId, name);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.id) onCreated(result.id);
  }

  return (
    <Modal title={`New folder · ${parentName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 p-4">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="folder name"
          aria-label="Folder name"
          className={fieldClass}
        />
        {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {busy ? "Creating" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SaveProjectDialog({
  fileCount,
  onClose,
  onSave,
}: {
  fileCount: number;
  onClose: () => void;
  onSave: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(message.trim());
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Save project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 p-4">
        <p className="text-[12px] leading-relaxed text-ink-dim">
          {fileCount} changed file{fileCount === 1 ? "" : "s"} will be saved together as one
          snapshot.
        </p>
        <input
          autoFocus
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="message (optional)"
          aria-label="Snapshot message"
          className={fieldClass}
        />
        {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {busy ? "Saving" : "Save project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ProjectHistoryDialog({
  projectId,
  projectName,
  onClose,
  onRestored,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listSnapshots(projectId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSnapshots(result.snapshots);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(id: string) {
    setBusy(true);
    const result = await restoreProjectSnapshot(id);
    setBusy(false);
    setConfirming(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNote(`Restored ${result.changed} file${result.changed === 1 ? "" : "s"}.`);
    onRestored();
    await load();
  }

  return (
    <Modal title={`Project history · ${projectName}`} onClose={onClose}>
      {error ? (
        <p className="border-b border-rule bg-accent/10 px-4 py-2 text-[11px] text-ink">{error}</p>
      ) : null}
      {note ? (
        <p className="border-b border-rule px-4 py-2 text-[11px] text-ink-dim">{note}</p>
      ) : null}

      <div className="max-h-[46vh] overflow-y-auto">
        {snapshots !== null && snapshots.length === 0 ? (
          <p className="px-4 py-6 text-[12px] leading-relaxed text-ink-faint">
            No project snapshots yet. Save Project creates one and captures every changed file
            at once.
          </p>
        ) : null}

        {snapshots?.map((snapshot) => {
          const when = stampDate(snapshot.created_at);
          const asking = confirming === snapshot.id;

          return (
            <div
              key={snapshot.id}
              className="flex items-center gap-3 border-b border-rule px-4 py-2 text-[11px]"
            >
              <span className="w-[86px] shrink-0 font-mono text-[10px] text-ink-faint">
                {when.day}
              </span>
              <span className="w-[64px] shrink-0 font-mono text-[10px] text-ink-dim">
                {when.time}
              </span>
              <span className="w-[92px] shrink-0 font-mono text-[10px] text-ink-faint">
                {snapshot.file_count} file{snapshot.file_count === 1 ? "" : "s"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-dim">
                {snapshot.message ?? ""}
              </span>

              {asking ? (
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(snapshot.id)}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent"
                  >
                    restore all
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint"
                  >
                    no
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(snapshot.id)}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink"
                >
                  restore
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          restoring writes every changed file
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-7 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

const SOURCE_LABEL: Record<VersionSummary["source"], string> = {
  file: "save",
  project: "project",
  auto: "auto",
};

function stampDate(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" }),
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

/**
 * The per-file history. Restoring puts the content into the buffer, it does not
 * write the file, so the user still decides when to save.
 */
export function VersionHistoryDialog({
  fileId,
  fileName,
  onClose,
  onRestore,
}: {
  fileId: string;
  fileName: string;
  onClose: () => void;
  onRestore: (content: string) => void;
}) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [hideAuto, setHideAuto] = useState(false);

  const load = useCallback(async () => {
    const result = await listVersions(fileId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVersions(result.versions);
  }, [fileId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(id: string) {
    setBusyId(id);
    const result = await restoreVersion(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onRestore(result.content);
    await load();
  }

  async function remove(id: string) {
    setBusyId(id);
    const result = await deleteVersion(id);
    setBusyId(null);
    setConfirmDelete(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await load();
  }

  const visible = (versions ?? []).filter((version) => !hideAuto || version.source !== "auto");

  return (
    <Modal title={`Version history · ${fileName}`} onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-rule px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          {versions === null ? "loading" : `${visible.length} version${visible.length === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          onClick={() => setHideAuto((value) => !value)}
          aria-pressed={hideAuto}
          className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
        >
          {hideAuto ? "show auto" : "hide auto"}
        </button>
      </div>

      {error ? (
        <p className="border-b border-rule bg-accent/10 px-4 py-2 text-[11px] text-ink">{error}</p>
      ) : null}

      <div className="max-h-[46vh] overflow-y-auto">
        {versions !== null && visible.length === 0 ? (
          <p className="px-4 py-6 text-[12px] leading-relaxed text-ink-faint">
            No saved versions yet. Press Save File to create one.
          </p>
        ) : null}

        {visible.map((version) => {
          const when = stampDate(version.created_at);
          const confirming = confirmDelete === version.id;

          return (
            <div
              key={version.id}
              className="flex items-center gap-3 border-b border-rule px-4 py-2 text-[11px]"
            >
              <span className="w-[86px] shrink-0 font-mono text-[10px] text-ink-faint">
                {when.day}
              </span>
              <span className="w-[64px] shrink-0 font-mono text-[10px] text-ink-dim">
                {when.time}
              </span>
              <span className="w-[54px] shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                {SOURCE_LABEL[version.source]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-dim">
                {version.label ?? ""}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                {version.byte_size} B
              </span>

              {confirming ? (
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void remove(version.id)}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent"
                  >
                    delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint"
                  >
                    no
                  </button>
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === version.id}
                    onClick={() => void restore(version.id)}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-40"
                  >
                    restore
                  </button>
                  <button
                    type="button"
                    disabled={busyId === version.id}
                    onClick={() => setConfirmDelete(version.id)}
                    className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:text-accent disabled:opacity-40"
                  >
                    delete
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end px-4 py-2">
        <button
          type="button"
          onClick={onClose}
          className="h-7 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4 p-4">
        <p className="text-[13px] leading-relaxed text-ink-dim">{body}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-rule px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 border border-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-accent"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

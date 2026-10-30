"use client";

import { useEffect, useRef, useState } from "react";
import { createFile, createFolder, type FileKind } from "./actions";

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
    <Modal title={`New file — ${folderName}`} onClose={onClose}>
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
    <Modal title={`New folder — ${parentName}`} onClose={onClose}>
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

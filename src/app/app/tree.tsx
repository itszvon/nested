"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  buildWorkspace,
  flattenWorkspace,
  type FileRow,
  type FolderRow,
  type TreeNode,
} from "@/lib/tree";
import { renameNode, trashNode } from "./actions";
import { TypeIcon } from "./icons";
import { ConfirmDialog, NewFileDialog, NewFolderDialog } from "./dialogs";

const EXPANDED_KEY = "nested.expanded";

function formatBytes(bytes: number | undefined) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function languageLabel(node: TreeNode) {
  return node.type === "file" && node.kind === "code" ? node.language ?? "code" : "";
}

function countSubtree(node: TreeNode) {
  let folders = 0;
  let files = 0;
  for (const child of node.children) {
    if (child.type === "folder") folders++;
    else files++;
    const deeper = countSubtree(child);
    folders += deeper.folders;
    files += deeper.files;
  }
  return { folders, files };
}

type Menu = { id: string; kind: "folder" | "file"; name: string } | null;
type Renaming = { id: string; kind: "folder" | "file"; value: string } | null;

export function WorkspaceTree({
  folders,
  files,
  selectedId,
}: {
  folders: FolderRow[];
  files: FileRow[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const workspace = useMemo(() => buildWorkspace(folders, files), [folders, files]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const [menu, setMenu] = useState<Menu>(null);
  const [renaming, setRenaming] = useState<Renaming>(null);
  const [trashTarget, setTrashTarget] = useState<TreeNode | null>(null);
  const [newFileTarget, setNewFileTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [newFolderTarget, setNewFolderTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Enter commits, which unmounts the input and fires blur too.
  const committing = useRef(false);

  // Bulk selection is separate from the open file: you can tick ten rows
  // without opening any of them.
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const anchorRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      if (raw) setExpanded(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* corrupt storage is not worth failing over */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
    } catch {
      /* ignore quota errors */
    }
  }, [expanded, hydrated]);

  // Close the row menu on any outside interaction.
  useEffect(() => {
    if (!menu) return;
    function close(event: PointerEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[data-row-menu]")) return;
      setMenu(null);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const selectedNode = selectedId ? workspace.index.get(selectedId) ?? null : null;
  const targetFolder =
    selectedNode?.type === "folder"
      ? selectedNode
      : selectedNode?.parentId
        ? workspace.index.get(selectedNode.parentId) ?? null
        : null;

  const showRootFiles = workspace.looseFiles.length > 0;
  const rows = useMemo(
    () => flattenWorkspace(workspace, expanded, showRootFiles),
    [workspace, expanded, showRootFiles],
  );

  // Keep the roving focus inside the list as it shrinks.
  useEffect(() => {
    if (focusIndex > rows.length - 1) setFocusIndex(Math.max(0, rows.length - 1));
  }, [rows.length, focusIndex]);

  // A reload restores ?f=, but the file may sit inside collapsed folders.
  useEffect(() => {
    if (!selectedId) return;
    const node = workspace.index.get(selectedId);
    if (!node) return;

    const ancestors: string[] = [];
    let parent = node.parentId;
    while (parent) {
      ancestors.push(parent);
      parent = workspace.index.get(parent)?.parentId ?? null;
    }
    if (ancestors.length === 0) return;

    setExpanded((current) => {
      const missing = ancestors.filter((id) => !current.has(id));
      if (missing.length === 0) return current;
      const next = new Set(current);
      for (const id of missing) next.add(id);
      return next;
    });
  }, [selectedId, workspace]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectFile(id: string) {
    router.replace(`${pathname}?f=${id}`, { scroll: false });
  }

  function focusRow(index: number) {
    const clamped = Math.max(0, Math.min(index, rows.length - 1));
    setFocusIndex(clamped);
    rowRefs.current[clamped]?.focus();
  }

  const DEFAULT_EXT: Record<string, string> = {
    python: "py",
    java: "java",
    javascript: "js",
    html: "html",
    css: "css",
    cpp: "cpp",
  };

  /**
   * A code file without an extension cannot be identified, so a rename that
   * would drop it gets the file's own extension put back.
   */
  function withExtension(value: string, node: TreeNode | undefined) {
    if (!node || node.type !== "file" || node.kind !== "code") return value;
    if (/\.(py|java|js|html|css|cpp|h|hpp)$/i.test(value)) return value;
    const ext = DEFAULT_EXT[node.language ?? "python"] ?? "py";
    return `${value}.${ext}`;
  }

  function toggleSelected(id: string) {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectRange(toIndex: number) {
    const from = anchorRef.current ?? 0;
    const low = Math.min(from, toIndex);
    const high = Math.max(from, toIndex);
    setSelection(new Set(rows.slice(low, high + 1).map((row) => row.node.id)));
  }

  async function trashSelection() {
    setBulkConfirm(false);
    const ids = [...selection];
    const selected = new Set(ids);

    // Trashing a folder already trashes its children; sending both would fail
    // on the second call.
    const roots = ids
      .map((id) => workspace.index.get(id))
      .filter((node): node is TreeNode => Boolean(node))
      .filter((node) => {
        let parent = node.parentId;
        while (parent) {
          if (selected.has(parent)) return false;
          parent = workspace.index.get(parent)?.parentId ?? null;
        }
        return true;
      });

    let failed = 0;
    for (const node of roots) {
      const result = await trashNode(node.type, node.id);
      if (!result.ok) failed++;
    }

    setSelection(new Set());
    if (selectedId && selected.has(selectedId)) router.replace(pathname, { scroll: false });
    if (failed > 0) setNotice(`${failed} item${failed === 1 ? "" : "s"} could not be trashed.`);
    router.refresh();
  }

  async function commitRename() {
    if (!renaming || committing.current) return;
    committing.current = true;

    const next = withExtension(renaming.value.trim(), workspace.index.get(renaming.id));
    const node = workspace.index.get(renaming.id);
    setRenaming(null);

    try {
      if (!next || next === node?.name) return;

      const result = await renameNode(renaming.kind, renaming.id, next);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      router.refresh();
    } finally {
      committing.current = false;
    }
  }

  async function commitTrash() {
    if (!trashTarget) return;
    const target = trashTarget;
    setTrashTarget(null);

    const result = await trashNode(target.type === "folder" ? "folder" : "file", target.id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    if (selectedId === target.id) router.replace(pathname, { scroll: false });
    router.refresh();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>, index: number) {
    const row = rows[index];
    if (!row) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(index - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.node.type === "folder" && !row.expanded && row.hasChildren) toggle(row.node.id);
        else if (row.expanded && row.hasChildren) focusRow(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (row.node.type === "folder" && row.expanded) {
          toggle(row.node.id);
        } else {
          for (let i = index - 1; i >= 0; i--) {
            if (rows[i].depth < row.depth) {
              focusRow(i);
              break;
            }
          }
        }
        break;
      case "Enter":
        event.preventDefault();
        if (row.node.type === "folder") toggle(row.node.id);
        else selectFile(row.node.id);
        break;
      case " ":
        event.preventDefault();
        toggleSelected(row.node.id);
        break;
      case "a":
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          setSelection(new Set(rows.map((entry) => entry.node.id)));
        }
        break;
      case "F2":
        event.preventDefault();
        setRenaming({
          id: row.node.id,
          kind: row.node.type,
          value: row.node.name,
        });
        break;
      case "Delete":
        event.preventDefault();
        setTrashTarget(row.node);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows.length - 1);
        break;
      case "Escape":
        setMenu(null);
        break;
    }
  }

  const trashCounts = trashTarget ? countSubtree(trashTarget) : null;

  return (
    <>
      <div className="flex h-9 items-center gap-1 border-b border-rule px-2">
        <button
          type="button"
          onClick={() =>
            setNewFolderTarget({ id: targetFolder?.id ?? null, name: targetFolder?.name ?? "root" })
          }
          className="h-6 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink"
        >
          + Folder
        </button>
        <button
          type="button"
          onClick={() =>
            setNewFileTarget({ id: targetFolder?.id ?? null, name: targetFolder?.name ?? "root" })
          }
          className="h-6 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink"
        >
          + File
        </button>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {targetFolder ? targetFolder.name : "root"}
        </span>
      </div>

      {selection.size > 0 ? (
        <div className="flex h-8 items-center gap-3 border-b border-rule bg-[#111614] px-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
            {selection.size} selected
          </span>
          <button
            type="button"
            onClick={() => setBulkConfirm(true)}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent hover:text-ink"
          >
            trash
          </button>
          <button
            type="button"
            onClick={() => setSelection(new Set())}
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
          >
            clear
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-2 border-b border-rule bg-accent/10 px-3 py-2 text-[11px] text-ink">
          <span className="flex-1 leading-relaxed">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-3 py-6 text-[13px] leading-relaxed text-ink-faint">
          <p className="text-ink-dim">Nothing here yet.</p>
          <p className="mt-1">
            Use <span className="font-mono text-[11px] text-ink-dim">+ Folder</span> to create a
            project, then add a file inside it.
          </p>
        </div>
      ) : (
        <div role="tree" aria-label="Files and folders" className="pb-6">
          {rows.map((row, index) => {
            const isSelected = row.node.id === selectedId;
            const isFolder = row.node.type === "folder";
            const isRenaming = renaming?.id === row.node.id;
            const menuOpen = menu?.id === row.node.id;

            return (
              <div
                key={row.node.id}
                ref={(el) => {
                  rowRefs.current[index] = el;
                }}
                role="treeitem"
                aria-level={row.depth + 1}
                aria-expanded={isFolder ? row.expanded : undefined}
                aria-selected={isSelected}
                tabIndex={index === focusIndex ? 0 : -1}
                onKeyDown={(event) => onKeyDown(event, index)}
                onClick={(event) => {
                  setFocusIndex(index);

                  if (event.shiftKey) {
                    selectRange(index);
                    return;
                  }
                  if (event.metaKey || event.ctrlKey) {
                    toggleSelected(row.node.id);
                    anchorRef.current = index;
                    return;
                  }

                  anchorRef.current = index;
                  setSelection(new Set([row.node.id]));
                  if (isFolder) toggle(row.node.id);
                  else selectFile(row.node.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setFocusIndex(index);
                  setMenu({ id: row.node.id, kind: row.node.type, name: row.node.name });
                }}
                className={[
                  "group relative flex h-7 cursor-default items-center gap-1.5 border-b border-rule pr-1.5 text-[13px] select-none",
                  "hover:bg-[#111614]",
                  selection.has(row.node.id) ? "bg-[#141a17]" : "",
                  isSelected
                    ? "bg-panel shadow-[inset_2px_0_0_var(--color-accent)]"
                    : selection.has(row.node.id)
                      ? "shadow-[inset_2px_0_0_#3d4744]"
                      : "",
                  isFolder ? "text-ink" : "text-ink-dim",
                ].join(" ")}
                style={{ paddingLeft: 8 + row.depth * 14 }}
              >
                <span
                  aria-hidden="true"
                  className="w-3 shrink-0 text-center font-mono text-[9px] text-ink-faint"
                >
                  {isFolder && row.hasChildren ? (row.expanded ? "▾" : "▸") : ""}
                </span>

                <TypeIcon
                  kind={isFolder ? "folder" : row.node.kind === "code" ? "code" : "text"}
                  className={isSelected ? "text-accent" : "text-ink-faint"}
                />

                {isRenaming ? (
                  <input
                    autoFocus
                    value={renaming.value}
                    onChange={(event) => setRenaming({ ...renaming, value: event.target.value })}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void commitRename();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setRenaming(null);
                      }
                    }}
                    className="min-w-0 flex-1 border border-accent bg-ground px-1 text-[13px] text-ink outline-none"
                  />
                ) : (
                  <span className="truncate">{row.node.name}</span>
                )}

                <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] tracking-tight text-ink-faint group-hover:hidden">
                  {isFolder
                    ? row.node.children.length > 0
                      ? String(row.node.children.length)
                      : ""
                    : isSelected
                      ? formatBytes(row.node.byteSize)
                      : languageLabel(row.node)}
                </span>

                <button
                  type="button"
                  aria-label={`Actions for ${row.node.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenu({ id: row.node.id, kind: row.node.type, name: row.node.name });
                  }}
                  className="hidden h-5 w-5 shrink-0 items-center justify-center text-ink-faint hover:text-ink group-hover:flex"
                >
                  ⋯
                </button>

                {menuOpen ? (
                  <div
                    data-row-menu
                    className="absolute right-0 top-6 z-30 w-[168px] border border-rule-strong bg-panel py-1 shadow-none"
                  >
                    {isFolder ? (
                      <>
                        <MenuItem
                          onClick={() => {
                            setMenu(null);
                            setNewFileTarget({ id: row.node.id, name: row.node.name });
                          }}
                        >
                          New file
                        </MenuItem>
                        <MenuItem
                          onClick={() => {
                            setMenu(null);
                            setNewFolderTarget({ id: row.node.id, name: row.node.name });
                          }}
                        >
                          New folder
                        </MenuItem>
                      </>
                    ) : null}
                    {!isFolder ? (
                      <MenuItem
                        onClick={() => {
                          setMenu(null);
                          router.replace(`${pathname}?f=${row.node.id}&versions=1`, {
                            scroll: false,
                          });
                        }}
                      >
                        Version history
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      onClick={() => {
                        setMenu(null);
                        setRenaming({ id: row.node.id, kind: row.node.type, value: row.node.name });
                      }}
                    >
                      Rename
                    </MenuItem>
                    <MenuItem
                      danger
                      onClick={() => {
                        setMenu(null);
                        setTrashTarget(row.node);
                      }}
                    >
                      Move to trash
                    </MenuItem>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {newFileTarget ? (
        <NewFileDialog
          folderId={newFileTarget.id}
          folderName={newFileTarget.name}
          onClose={() => setNewFileTarget(null)}
          onCreated={(fileId) => {
            setNewFileTarget(null);
            if (newFileTarget.id) {
              setExpanded((current) => new Set(current).add(newFileTarget.id!));
            }
            router.replace(`${pathname}?f=${fileId}`, { scroll: false });
            router.refresh();
          }}
        />
      ) : null}

      {newFolderTarget ? (
        <NewFolderDialog
          parentId={newFolderTarget.id}
          parentName={newFolderTarget.name}
          onClose={() => setNewFolderTarget(null)}
          onCreated={(folderId) => {
            const parentId = newFolderTarget.id;
            setNewFolderTarget(null);
            if (parentId) setExpanded((current) => new Set(current).add(parentId));
            setExpanded((current) => new Set(current).add(folderId));
            router.refresh();
          }}
        />
      ) : null}

      {bulkConfirm ? (
        <ConfirmDialog
          title="Move to trash"
          body={`${selection.size} item${selection.size === 1 ? "" : "s"} go to the trash. You can restore them for 30 days.`}
          confirmLabel="Move to trash"
          onClose={() => setBulkConfirm(false)}
          onConfirm={trashSelection}
        />
      ) : null}

      {trashTarget ? (
        <ConfirmDialog
          title={`Move ${trashTarget.type === "folder" ? "folder" : "file"} to trash`}
          body={
            trashTarget.type === "folder"
              ? `“${trashTarget.name}” and everything inside it goes to the trash: ${trashCounts?.folders ?? 0} subfolders, ${trashCounts?.files ?? 0} files. You can restore it for 30 days.`
              : `“${trashTarget.name}” goes to the trash. You can restore it for 30 days.`
          }
          confirmLabel="Move to trash"
          onClose={() => setTrashTarget(null)}
          onConfirm={commitTrash}
        />
      ) : null}
    </>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#161b18]",
        danger ? "text-accent" : "text-ink-dim hover:text-ink",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

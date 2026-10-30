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

const EXPANDED_KEY = "nested.expanded";

function formatBytes(bytes: number | undefined) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function languageLabel(node: TreeNode) {
  if (node.type === "file" && node.kind === "code") {
    return node.language ?? "code";
  }
  return "";
}

/**
 * The sidebar. Flat DOM, ARIA tree semantics, roving tabindex, and a right
 * column that reads like a ledger: what it is, how big it is.
 */
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

  // Expansion belongs to the device, not the account, and never to the server.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      if (raw) setExpanded(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* corrupt or unavailable storage is not worth failing over */
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

  // A reload restores ?f=, but the file may sit inside collapsed folders.
  // Opening its ancestors keeps the selection visible instead of hidden.
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

  const showRootFiles = workspace.looseFiles.length > 0;
  const rows = useMemo(
    () => flattenWorkspace(workspace, expanded, showRootFiles),
    [workspace, expanded, showRootFiles],
  );

  // Keep the roving focus inside the list as it shrinks.
  useEffect(() => {
    if (focusIndex > rows.length - 1) setFocusIndex(Math.max(0, rows.length - 1));
  }, [rows.length, focusIndex]);

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
      case " ":
        event.preventDefault();
        if (row.node.type === "folder") toggle(row.node.id);
        else selectFile(row.node.id);
        break;
      case "Home":
        event.preventDefault();
        focusRow(0);
        break;
      case "End":
        event.preventDefault();
        focusRow(rows.length - 1);
        break;
    }
  }

  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-[13px] leading-relaxed text-ink-faint">
        <p className="text-ink-dim">Nothing here yet.</p>
        <p className="mt-1">Create a project to start. Folders nest as deep as you need.</p>
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Files and folders" className="pb-6">
      {rows.map((row, index) => {
        const isSelected = row.node.id === selectedId;
        const isFolder = row.node.type === "folder";

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
            onClick={() => {
              setFocusIndex(index);
              if (isFolder) toggle(row.node.id);
              else selectFile(row.node.id);
            }}
            className={[
              "group flex h-7 cursor-default items-center gap-1.5 border-b border-rule/70 pr-2 text-[13px]",
              "hover:bg-[#111614]",
              isSelected ? "bg-panel shadow-[inset_2px_0_0_var(--color-accent)]" : "",
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

            <span className="truncate">{row.node.name}</span>

            <span className="ml-auto shrink-0 pl-2 font-mono text-[10px] tracking-tight text-ink-faint">
              {isFolder
                ? row.node.children.length > 0
                  ? String(row.node.children.length)
                  : ""
                : isSelected
                  ? formatBytes(row.node.byteSize)
                  : languageLabel(row.node)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FileRow, FolderRow } from "@/lib/tree";

type Item = {
  id: string;
  label: string;
  detail: string;
  run: () => void;
};

/**
 * Ctrl/Cmd+K. Name-only, client-side: the tree is already loaded, so this adds
 * no queries and never touches the server until a row is chosen.
 */
export function CommandPalette({ folders, files }: { folders: FolderRow[]; files: FileRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
        setIndex(0);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];

    for (const file of files) {
      list.push({
        id: `file:${file.id}`,
        label: file.name,
        detail: file.kind === "code" ? `file · ${file.language ?? "code"}` : "file · markdown",
        run: () => router.replace(`/app?f=${file.id}`, { scroll: false }),
      });
    }

    for (const folder of folders) {
      list.push({
        id: `folder:${folder.id}`,
        label: folder.name,
        detail: folder.parent_id ? "folder" : "project",
        run: () => {
          window.dispatchEvent(new CustomEvent("nested:reveal", { detail: folder.id }));
          router.replace("/app");
        },
      });
    }

    list.push({
      id: "action:settings",
      label: "Open settings",
      detail: "action",
      run: () => router.push("/settings"),
    });
    list.push({
      id: "action:versions",
      label: "Open versions",
      detail: "action",
      run: () => router.push("/settings/versions"),
    });
    list.push({
      id: "action:home",
      label: "Open home page",
      detail: "action",
      run: () => router.push("/home"),
    });

    return list;
  }, [files, folders, router]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? items.filter((item) => item.label.toLowerCase().includes(needle))
      : items;
    return matches.slice(0, 40);
  }, [items, query]);

  const active = Math.min(index, Math.max(0, filtered.length - 1));

  function choose(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    item.run();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[15vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="w-[520px] border border-rule-strong bg-panel">
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((value) => Math.min(value + 1, filtered.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(filtered[active]);
            }
          }}
          placeholder="Jump to a file or folder, or run a command"
          aria-label="Search files and commands"
          className="h-11 w-full border-b border-rule bg-ground px-4 text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />

        <div className="max-h-[45vh] overflow-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-ink-faint">Nothing matches.</p>
          ) : (
            filtered.map((item, position) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setIndex(position)}
                onClick={() => choose(item)}
                className={[
                  "flex w-full items-center gap-3 px-4 py-1.5 text-left text-[12px]",
                  position === active ? "bg-[#141a17] text-ink" : "text-ink-dim",
                ].join(" ")}
              >
                <span className="truncate">{item.label}</span>
                <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                  {item.detail}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-rule px-4 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          <span>↑↓ move</span>
          <span>enter open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

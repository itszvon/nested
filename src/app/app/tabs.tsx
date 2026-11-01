"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FileRow } from "@/lib/tree";

const KEY = "nested.openTabs";
const CLOSED_KEY = "nested.closedTabs";
const MAX = 20;

type DirtyEvent = CustomEvent<{ id: string; dirty: boolean }>;

/**
 * Open files, in the order they were opened. The URL stays authoritative
 * (?f= primary, ?s= split), so a reload restores exactly what was on screen.
 *
 * A tab click opens in the primary pane; clicking the tab that is already in
 * the split pane swaps the two. The split control on a non-active tab puts that
 * file in the second pane.
 */
export function FileTabs({
  files,
  activeId,
  splitId,
}: {
  files: FileRow[];
  activeId: string | null;
  splitId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [tabs, setTabs] = useState<string[]>([]);
  const [closed, setClosed] = useState<string[]>([]);
  const closedRef = useRef<string[]>([]);

  useEffect(() => {
    closedRef.current = closed;
  }, [closed]);
  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // Hydration-safe read of local UI state; there is no external store.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setTabs((JSON.parse(raw) as string[]).slice(-MAX));
      const recent = localStorage.getItem(CLOSED_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (recent) setClosed((JSON.parse(recent) as string[]).slice(-20));
    } catch {
      /* corrupt storage is not worth failing over */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(tabs));
      localStorage.setItem(CLOSED_KEY, JSON.stringify(closed));
    } catch {
      /* ignore quota errors */
    }
  }, [tabs, closed, hydrated]);

  // Opening a file by any route (tree, palette, a link) adds it to the strip.
  useEffect(() => {
    if (!activeId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs((current) =>
      current.includes(activeId) ? current : [...current, activeId].slice(-MAX),
    );
  }, [activeId]);

  // The pane reports its own unsaved state; the strip only draws the dot.
  useEffect(() => {
    function onDirty(event: Event) {
      const { id, dirty: isDirty } = (event as DirtyEvent).detail;
      setDirty((current) => {
        const next = new Set(current);
        if (isDirty) next.add(id);
        else next.delete(id);
        return next;
      });
    }
    window.addEventListener("nested:dirty", onDirty);
    return () => window.removeEventListener("nested:dirty", onDirty);
  }, []);

  function navigate(nextActive: string | null, nextSplit: string | null) {
    const params = new URLSearchParams();
    if (nextActive) params.set("f", nextActive);
    if (nextSplit && nextSplit !== nextActive) params.set("s", nextSplit);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function open(id: string) {
    if (id === splitId && activeId) {
      navigate(id, activeId);
      return;
    }
    navigate(id, splitId && splitId !== id ? splitId : null);
  }

  function close(id: string) {
    const index = tabs.indexOf(id);
    const nextTabs = tabs.filter((tab) => tab !== id);
    setTabs(nextTabs);

    let nextActive = activeId;
    let nextSplit = splitId;

    if (id === activeId) {
      nextActive = nextTabs[Math.min(index, nextTabs.length - 1)] ?? null;
    }
    if (id === splitId) nextSplit = null;
    if (nextSplit === nextActive) nextSplit = null;

    setClosed((stack) => [...stack, id].slice(-20));

    setDirty((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

    navigate(nextActive, nextSplit);
  }

  function reopenLast() {
    const id = closedRef.current[closedRef.current.length - 1];
    if (!id) return;

    setClosed((stack) => stack.slice(0, -1));
    setTabs((current) => (current.includes(id) ? current : [...current, id].slice(-MAX)));
    navigate(id, splitId);
  }

  // Ctrl/Cmd+Shift+T reopens the last closed tab, in this app rather than the
  // browser's tab history.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "t"
      ) {
        event.preventDefault();
        reopenLast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitId]);

  function toggleSplit(id: string) {
    if (id === activeId) return;
    navigate(activeId, splitId === id ? null : id);
  }

  if (tabs.length === 0) return null;

  const nameOf = (id: string) => files.find((file) => file.id === id)?.name ?? "missing file";

  return (
    <div
      role="tablist"
      aria-label="Open files"
      className="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-rule bg-ground/40"
    >
      {tabs.map((id) => {
        const active = id === activeId;
        const split = id === splitId;

        return (
          <div
            key={id}
            className={[
              "group flex min-w-0 max-w-[220px] items-center gap-1.5 border-r border-rule pl-3 pr-1",
              active ? "bg-panel text-ink shadow-[inset_0_2px_0_var(--color-accent)]" : "",
              split && !active ? "text-[var(--color-accent-text)]" : "text-ink-dim",
            ].join(" ")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => open(id)}
              title={active ? `${nameOf(id)} (primary pane)` : `${nameOf(id)} — click to swap in`}
              className="flex min-w-0 items-center gap-1.5 py-1 text-[11px] hover:text-ink"
            >
              {dirty.has(id) ? (
                <span aria-label="unsaved changes" className="h-1.5 w-1.5 shrink-0 bg-accent" />
              ) : null}
              {split && !active ? (
                <span aria-label="in split view" className="shrink-0 font-mono text-[9px]">
                  ◫
                </span>
              ) : null}
              <span className="truncate">{nameOf(id)}</span>
            </button>

            {!active ? (
              <button
                type="button"
                onClick={() => toggleSplit(id)}
                title={split ? "Close split view" : "Open in split view"}
                aria-label={split ? "Close split view" : `Open ${nameOf(id)} in split view`}
                className="shrink-0 px-1 font-mono text-[10px] text-ink-faint hover:text-ink"
              >
                ◫
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => close(id)}
              title={`Close ${nameOf(id)}`}
              aria-label={`Close ${nameOf(id)}`}
              className="shrink-0 px-1 font-mono text-[11px] text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

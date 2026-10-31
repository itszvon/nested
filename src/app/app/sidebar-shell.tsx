"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "nested.sidebarWidth";
const MIN = 200;
const MAX = 620;

/**
 * The sidebar, resizable by dragging its right edge. The width is remembered
 * per device, like the expanded folders.
 */
export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(300);
  const dragging = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (Number.isFinite(saved) && saved >= MIN && saved <= MAX) setWidth(saved);
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!dragging.current) return;
      setWidth(Math.min(MAX, Math.max(MIN, event.clientX)));
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  return (
    <div style={{ width }} className="relative flex shrink-0">
      <aside className="h-full w-full overflow-y-auto border-r border-rule bg-panel/50">
        {children}
      </aside>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={(event) => {
          dragging.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          event.preventDefault();
        }}
        className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize hover:bg-accent/40"
      />
    </div>
  );
}

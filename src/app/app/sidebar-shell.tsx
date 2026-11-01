"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "nested.sidebarWidth";
const MIN = 200;
const MAX = 620;

/**
 * The sidebar, resizable by dragging its right edge and, below the md
 * breakpoint, a drawer opened by the header's files button.
 */
export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(300);
  const [open, setOpen] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number.isFinite(saved) && saved >= MIN && saved <= MAX) setWidth(saved);
  }, []);

  useEffect(() => {
    function toggle() {
      setOpen((current) => !current);
    }
    window.addEventListener("nested:toggle-sidebar", toggle);
    return () => window.removeEventListener("nested:toggle-sidebar", toggle);
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
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        style={{ width }}
        className={[
          "z-40 flex h-full max-w-[85vw] shrink-0 transition-transform duration-150 md:static md:max-w-none md:translate-x-0",
          "fixed inset-y-0 left-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <aside className="h-full w-full overflow-y-auto border-r border-rule bg-panel">
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
          className="absolute -right-1 top-0 hidden h-full w-2 cursor-col-resize hover:bg-accent/40 md:block"
        />
      </div>
    </>
  );
}

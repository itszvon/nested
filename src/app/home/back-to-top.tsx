"use client";

import { useEffect, useState } from "react";

/** Appears once the page is scrolled past the hero, on long pages only. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 800);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <a
      href="#top"
      className="fixed bottom-6 right-6 z-30 border border-rule-strong bg-panel px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-dim hover:border-accent hover:text-ink"
    >
      top
    </a>
  );
}

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

  return (
    <a
      href="#top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 border border-hair-strong bg-shell px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-mute transition-all duration-300 hover:border-ember hover:text-bright ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <svg
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
        className="h-3 w-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="square"
      >
        <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
      </svg>
      Back to top
    </a>
  );
}

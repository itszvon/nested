"use client";

/** Opens the sidebar drawer below the md breakpoint. */
export function SidebarToggle() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("nested:toggle-sidebar"))}
      className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink md:hidden"
    >
      files
    </button>
  );
}

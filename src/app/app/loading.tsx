/**
 * Shown while the workspace rows and the selected file stream in, so a click
 * from the landing page paints a shell immediately instead of a blank tab.
 */
export default function AppLoading() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-label="Loading workspace">
      <header className="flex h-10 shrink-0 items-center gap-3 border-b border-rule px-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink">Nested</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-rule p-3 md:block">
          <div className="space-y-2">
            {[64, 48, 80, 56, 40, 72].map((width, index) => (
              <div
                key={index}
                className="h-3 animate-pulse bg-panel/70"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            loading workspace
          </p>
        </div>
      </div>
    </div>
  );
}

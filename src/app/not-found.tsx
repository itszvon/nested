import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-ink">
          Nothing at this address
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
          The page does not exist, or the file was deleted. Files you cannot open are usually in the
          trash for thirty days.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/app"
            className="border border-accent bg-accent px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
          >
            Open the app
          </Link>
          <Link
            href="/home"
            className="border border-rule-strong px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

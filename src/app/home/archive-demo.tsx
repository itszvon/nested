"use client";

import { useState } from "react";

/**
 * Two small interactive pieces on the landing page. They show the two ideas
 * the product is built on rather than describing them: depth, and a version
 * behind every save.
 */

const VERSIONS = [
  {
    at: "09:12:04",
    source: "save",
    code: 'def greet():\n    print("hello")\n',
  },
  {
    at: "09:40:17",
    source: "save",
    code: 'def greet(name):\n    print("hello", name)\n',
  },
  {
    at: "10:05:52",
    source: "save",
    code: 'def greet(name):\n    print(f"hello {name}")\n',
  },
  {
    at: "10:44:09",
    source: "project",
    code: 'def greet(name=""):\n    print(f"hello {name.strip() or "there"}")\n',
  },
  {
    at: "11:12:31",
    source: "save",
    code: 'def greet(name=""):\n    """Print a greeting. Empty names fall back to "there"."""\n    print(f"hello {name.strip() or "there"}")\n',
  },
];

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="square"
    >
      <path d="M8 4.5V8l2.5 1.5" />
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
      <path d="M2.5 2.5v2h2" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.1"
    >
      <path d="M2 4h4l1.3 1.8H14V13H2z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="square"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function VersionScrubber() {
  const [index, setIndex] = useState(VERSIONS.length - 1);
  const version = VERSIONS[index];
  const fill = (index / (VERSIONS.length - 1)) * 100;

  return (
    <div className="lg-panel">
      <div className="flex items-center justify-between border-b border-hair px-4 py-3">
        <div className="flex items-center gap-2.5">
          <HistoryIcon className="h-3.5 w-3.5 text-ember" />
          <span className="lg-label">version history</span>
        </div>
        <span className="border border-hair px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ghost">
          {version.source === "project" ? "project snapshot" : "single file"}
        </span>
      </div>

      <div className="flex items-baseline justify-between px-4 pt-4">
        <span className="font-mono text-[10px] tracking-[0.12em] text-ghost">{version.at}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ember">
          rev {index + 1} / {VERSIONS.length}
        </span>
      </div>

      <pre className="mt-3 min-h-[132px] overflow-x-auto px-4 font-mono text-[11.5px] leading-[1.8] text-mute">
        {version.code}
      </pre>

      <div className="px-4 pb-3">
        <input
          type="range"
          min={0}
          max={VERSIONS.length - 1}
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-label="Scrub through saved versions"
          className="lg-range"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
        />

        <div className="mt-1 flex items-start justify-between">
          {VERSIONS.map((entry, tick) => (
            <button
              key={entry.at}
              type="button"
              onClick={() => setIndex(tick)}
              aria-label={`Version ${tick + 1}, saved at ${entry.at}`}
              aria-pressed={tick === index}
              className="group flex flex-col items-center gap-1.5 px-1.5 pt-1"
            >
              <span
                className={`h-1 w-1 transition-colors ${
                  tick === index ? "bg-ember" : "bg-hair-strong group-hover:bg-ghost"
                }`}
              />
              <span
                className={`font-mono text-[8px] tracking-[0.08em] transition-colors ${
                  tick === index ? "text-bright" : "text-ghost group-hover:text-mute"
                }`}
              >
                {entry.at.slice(0, 5)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-hair px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ghost">
        <span>restore into the editor</span>
        <span className="ml-auto text-ember">drag to travel</span>
      </div>
    </div>
  );
}

export function NestingDemo() {
  const [depth, setDepth] = useState(3);
  const names = ["work", "api", "handlers", "v2", "draft", "tmp", "final"];

  return (
    <div className="lg-panel">
      <div className="flex items-center justify-between border-b border-hair px-4 py-3">
        <div className="flex items-center gap-2.5">
          <FolderIcon className="h-3.5 w-3.5 text-ember" />
          <span className="lg-label">folder depth</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ghost">
          depth{" "}
          <span className="text-bright">{depth.toString().padStart(2, "0")}</span>
        </span>
      </div>

      <div className="px-4 pb-4 pt-4">
        <div className="flex items-center gap-2 overflow-hidden border-b border-hair pb-3 font-mono text-[10px]">
          <span className="shrink-0 text-ghost">~/</span>
          {names.slice(0, depth).map((name, level) => (
            <span key={name} className="flex shrink-0 items-center gap-2">
              <span className={level === depth - 1 ? "text-bright" : "text-ghost"}>{name}</span>
              {level < depth - 1 ? (
                <span className="text-ghost/40" aria-hidden="true">
                  /
                </span>
              ) : null}
            </span>
          ))}
        </div>

        <div className="relative mt-3 min-h-[188px]">
          {Array.from({ length: names.length }).map((_, guide) => (
            <span
              key={guide}
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-hair/40"
              style={{ left: 12 + guide * 14 }}
            />
          ))}
          {names.slice(0, depth).map((name, level) => {
            const deepest = level === depth - 1;
            return (
              <div
                key={name}
                className={`lg-in relative flex h-8 items-center gap-2 border-b border-hair/70 pr-2 text-[11.5px] [animation-duration:300ms] ${
                  deepest
                    ? "bg-[rgba(255,107,69,0.08)] text-bright shadow-[inset_1px_0_0_var(--color-ember)]"
                    : "text-mute"
                }`}
                style={{ paddingLeft: 12 + level * 14 }}
              >
                <FolderIcon
                  className={`h-3 w-3 shrink-0 ${deepest ? "text-ember" : "text-ghost"}`}
                />
                <span className="truncate">{name}</span>
                <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-ghost">
                  {level === 0 ? "project" : `level ${level + 1}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDepth((current) => Math.min(names.length, current + 1))}
            disabled={depth >= names.length}
            className="flex items-center gap-2 border border-hair-strong px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-mute transition-colors hover:border-ember hover:text-bright disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hair-strong disabled:hover:text-mute"
          >
            <PlusIcon className="h-3 w-3" />
            Add a folder
          </button>
          <button
            type="button"
            onClick={() => setDepth(1)}
            disabled={depth === 1}
            className="border border-hair px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ghost transition-colors hover:text-bright disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ghost"
          >
            Reset
          </button>
          <span className="ml-auto hidden font-mono text-[8px] uppercase tracking-[0.12em] text-ghost sm:inline">
            no limit
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-hair px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ghost">
        <span>browser-like tree</span>
        <span className="ml-auto text-ember">try it</span>
      </div>
    </div>
  );
}

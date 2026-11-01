"use client";

import { useState } from "react";

/**
 * Two small interactive pieces on the landing page. They show the two things
 * the product actually does rather than describing them.
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

export function VersionScrubber() {
  const [index, setIndex] = useState(VERSIONS.length - 1);
  const version = VERSIONS[index];

  return (
    <div className="border border-rule bg-panel/40 p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
          version history
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-accent-text)]">
          {version.source === "project" ? "project save" : "save file"}
        </span>
      </div>

      <pre className="mt-3 min-h-[92px] overflow-x-auto font-mono text-[11px] leading-[1.7] text-ink-dim">
        {version.code}
      </pre>

      <input
        type="range"
        min={0}
        max={VERSIONS.length - 1}
        value={index}
        onChange={(event) => setIndex(Number(event.target.value))}
        aria-label="Scrub through saved versions"
        className="mt-3 w-full accent-[var(--color-accent)]"
      />

      <div className="mt-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
        <span>
          rev {index + 1} of {VERSIONS.length}
        </span>
        <span>{version.at}</span>
      </div>
    </div>
  );
}

export function NestingDemo() {
  const [depth, setDepth] = useState(3);
  const names = ["work", "api", "handlers", "v2", "draft", "tmp", "final"];

  return (
    <div className="border border-rule bg-panel/40 p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
          nesting
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">
          depth {depth}
        </span>
      </div>

      <div className="mt-3 min-h-[92px]">
        {names.slice(0, depth).map((name, level) => (
          <div
            key={name}
            className="flex h-6 items-center gap-2 border-b border-rule/60 text-[11px] text-ink-dim"
            style={{ paddingLeft: level * 10 }}
          >
            <span className="font-mono text-[8px] text-ink-faint">
              {level === depth - 1 ? "" : "▾"}
            </span>
            <span className={level === depth - 1 ? "text-ink" : ""}>{name}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setDepth((current) => Math.min(names.length, current + 1))}
          disabled={depth >= names.length}
          className="border border-rule-strong px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim hover:border-accent hover:text-ink disabled:opacity-40"
        >
          add a folder
        </button>
        <button
          type="button"
          onClick={() => setDepth(1)}
          className="border border-rule px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
        >
          reset
        </button>
      </div>
    </div>
  );
}

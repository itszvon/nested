import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Nested — notes and code, in folders inside folders",
  description:
    "A private place for notes, snippets and source files. Deep folders, a real editor for five languages, and explicit saves you can always return to.",
};

export const instant = false;

const LIMITS = [
  ["File size", "2 MB"],
  ["Account storage", "25 MB"],
  ["Files per account", "2,000"],
  ["Folders per account", "500"],
  ["Trash retention", "30 days"],
  ["Languages", "Python, Java, JavaScript, HTML/CSS, C++"],
];

const FEATURES = [
  {
    label: "01 / structure",
    title: "Nesting without a ceiling",
    body: "Projects sit at the top. Inside them, folders go inside folders, as deep as the work actually is. Drag to move, right-click to rename, and the whole tree stays keyboard-navigable.",
  },
  {
    label: "02 / editor",
    title: "An editor, not a text box",
    body: "Syntax colouring, bracket matching, folding, search and multi-cursor for five languages. Blank-line tidying per language, format, checks from the real parser, and a runner that keeps your session private.",
  },
  {
    label: "03 / history",
    title: "Saves you can prove",
    body: "Save File writes one file and appends a version. Save Project captures every changed file at once. Restore any of them, and a deleted file waits in the trash for thirty days.",
  },
];

function TreeRow({
  name,
  depth,
  meta,
  active,
}: {
  name: string;
  depth: number;
  meta: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex h-7 items-center gap-2 border-b border-rule pr-2 text-[12px] ${
        active ? "bg-panel text-ink shadow-[inset_2px_0_0_var(--color-accent)]" : "text-ink-dim"
      }`}
      style={{ paddingLeft: 10 + depth * 14 }}
    >
      <span className="w-3 text-center font-mono text-[9px] text-ink-faint">
        {depth === 0 ? "▸" : ""}
      </span>
      <span className="truncate">{name}</span>
      <span className="ml-auto font-mono text-[9px] text-ink-faint">{meta}</span>
    </div>
  );
}

function ProductMock() {
  return (
    <div className="border border-rule-strong bg-ground">
      <div className="flex h-9 items-center gap-3 border-b border-rule px-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">Nested</span>
        <span className="font-mono text-[9px] text-ink-faint">3 folders · 4 files</span>
        <span className="ml-auto font-mono text-[9px] text-ink-faint">you@gmail.com</span>
      </div>

      <div className="flex min-h-[300px]">
        <div className="w-[208px] shrink-0 border-r border-rule">
          <div className="flex h-8 items-center gap-3 border-b border-rule px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
            <span>+ folder</span>
            <span>+ file</span>
          </div>
          <TreeRow name="scratch.md" depth={0} meta="md" />
          <TreeRow name="algorithms" depth={0} meta="3" />
          <TreeRow name="graphs" depth={1} meta="1" />
          <TreeRow name="dijkstra.py" depth={2} meta="py" active />
          <TreeRow name="notes" depth={0} meta="2" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-9 items-center gap-3 border-b border-rule px-3">
            <span className="text-[12px] text-ink">dijkstra.py</span>
            <span className="font-mono text-[9px] uppercase text-ink-faint">python</span>
            <span className="font-mono text-[9px] text-ink-faint">rev 7</span>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
              save file
            </span>
          </div>
          <pre className="overflow-hidden px-3 py-2 font-mono text-[11px] leading-[1.7] text-ink-dim">
            <span className="text-ink-faint">1  </span>
            {"import heapq\n"}
            <span className="text-ink-faint">2  </span>
            {"\n"}
            <span className="text-ink-faint">3  </span>
            {"def shortest(graph, start):\n"}
            <span className="text-ink-faint">4  </span>
            {"    distances = {node: float('inf')}\n"}
            <span className="text-ink-faint">5  </span>
            {"    distances[start] = 0\n"}
            <span className="text-ink-faint">6  </span>
            {"    queue = [(0, start)]\n"}
            <span className="text-ink-faint">7  </span>
            {"    while queue:\n"}
            <span className="text-ink-faint">8  </span>
            {"        ..."}
          </pre>
        </div>
      </div>

      <div className="flex h-8 items-center gap-3 border-t border-rule px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
        <span className="text-accent">versions</span>
        <span>17 versions</span>
        <span className="ml-auto">saved 17:42</span>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  await connection();

  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/app");
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink">
            Nested
          </span>
          <nav className="ml-auto flex items-center gap-6">
            <a
              href="#how"
              className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink sm:inline"
            >
              How it works
            </a>
            <a
              href="#limits"
              className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink sm:inline"
            >
              Limits
            </a>
            <Link
              href="/login"
              className="border border-accent bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Private notes and code
          </p>

          <h1 className="mt-5 max-w-3xl text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
            Folders inside folders,
            <br />
            as deep as the work goes.
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-dim">
            A private place for the snippets, drafts and half-finished files that do not belong in
            a repository. Google sign-in, a real editor for five languages, and saves you can
            return to.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="border border-accent bg-accent px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white"
            >
              Continue with Google
            </Link>
            <a
              href="#how"
              className="border border-rule-strong px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim hover:border-ink-faint hover:text-ink"
            >
              See what it does
            </a>
          </div>

          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
            Google is the only way in. No sharing, no public links.
          </p>

          <div className="mt-16">
            <ProductMock />
          </div>
        </section>

        <section id="how" className="border-y border-rule">
          <div className="mx-auto grid max-w-6xl gap-px bg-rule px-0 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.label} className="bg-ground px-6 py-10">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">
                  {feature.label}
                </p>
                <h2 className="mt-4 text-[18px] font-medium tracking-[-0.01em] text-ink">
                  {feature.title}
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="limits" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-[22px] font-medium tracking-[-0.01em] text-ink">
                Deliberate limits
              </h2>
              <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-dim">
                Nested runs on free infrastructure, so it says what it cannot do instead of
                discovering it later. Nothing here is hidden behind a plan.
              </p>
              <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-faint">
                Java and C++ are edited and checked, but not executed: there is no browser runtime
                for either, and running them would mean sending your code to another service.
              </p>
            </div>

            <dl className="divide-y divide-rule border-y border-rule">
              {LIMITS.map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-4 py-3">
                  <dt className="w-40 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    {label}
                  </dt>
                  <dd className="text-[13px] text-ink-dim">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center">
            <div>
              <p className="text-[15px] text-ink">Start with an empty project.</p>
              <p className="mt-1 text-[13px] text-ink-faint">
                It takes one click to sign in, and one to make the first folder.
              </p>
            </div>
            <Link
              href="/login"
              className="border border-accent bg-accent px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white sm:ml-auto"
            >
              Continue with Google
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Nested
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint sm:ml-auto">
            Dark only · No tracking · Next.js and Supabase
          </span>
        </div>
      </footer>
    </div>
  );
}

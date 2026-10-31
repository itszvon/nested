import type { Metadata } from "next";
import Link from "next/link";
import { BackToTop } from "./back-to-top";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Nested · notes and code in folders inside folders",
  description:
    "Notes and code in one tree. Google sign-in, a code editor for ten languages, and a saved version behind every save.",
};

const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. It runs on free database and hosting tiers, which is why the limits above exist. There is no paid plan.",
  },
  {
    q: "Can anyone else see my files?",
    a: "No. Every row is tied to your account in the database, and there is no sharing, public link, or guest mode anywhere in the product.",
  },
  {
    q: "Which languages actually run?",
    a: "JavaScript, TypeScript, Python and SQL run in your browser. HTML and CSS render a preview. Java, Go, Rust, C++ and Bash are edited and checked but need their own tool.",
  },
  {
    q: "What happens when I delete something?",
    a: "It moves to the trash, where it stays for thirty days with its version history intact. After that it is removed permanently.",
  },
  {
    q: "What if I close the tab with unsaved work?",
    a: "Unsaved edits are copied into this browser every half second. Reopening the file offers them back. Nothing is saved to the server until you press Save File.",
  },
  {
    q: "Can I use it on a phone?",
    a: "It works, with the file tree as a drawer. Writing long files on a phone keyboard is not pleasant, but the editor and saving both function.",
  },
];

const LIMITS = [
  ["File size", "2 MB"],
  ["Account storage", "25 MB"],
  ["Files per account", "2,000"],
  ["Folders per account", "500"],
  ["Trash retention", "30 days"],
  ["Languages", "Python, JavaScript, TypeScript, Java, Go, Rust, C++, SQL, Bash, HTML/CSS"],
];

const FEATURES = [
  {
    label: "01 / structure",
    title: "Folders hold folders",
    body: "Projects sit at the top. Inside one, folders go inside folders with no depth limit. Drag a row to move it, press F2 to rename, and arrow keys walk the tree.",
  },
  {
    label: "02 / editor",
    title: "Five languages, one editor",
    body: "Python, JavaScript, TypeScript, Java, Go, Rust, C++, SQL, Bash and HTML/CSS. Colouring, bracket matching, folding, search, several cursors, a format button, and blank-line tidying that keeps the gaps between your functions.",
  },
  {
    label: "03 / history",
    title: "A version behind every save",
    body: "Save File records one file. Save Project records every changed file at once. The version list puts any of them back into the editor, and the file only changes when you save again. Deleted files sit in the trash for thirty days.",
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

// The page reads the session to label its buttons, so it renders per request.
export const instant = false;

export default async function LandingPage() {
  await connection();

  const signedIn =
    isSupabaseConfigured() ? Boolean(await getCurrentUser()) : false;

  return (
    <div id="top" className="min-h-dvh">
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
              href={signedIn ? "/app" : "/login"}
              className="border border-accent bg-accent px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white"
            >
              {signedIn ? "Open app" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            Private notes and code
          </p>

          <h1 className="mt-5 max-w-4xl text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.07] tracking-[-0.03em] text-ink">
            Notes, Markdown and code in one tree:
            <br />
            folders inside folders, ten languages,
            <br />
            a saved version behind every save.
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-dim">
            For the drafts, snippets and half-finished files that do not belong in a repository.
            Sign in with Google, make a folder, start typing. Every save leaves a version you can
            go back to.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={signedIn ? "/app" : "/login"}
              className="border border-accent bg-accent px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white"
            >
              {signedIn ? "Open the app" : "Continue with Google"}
            </Link>
            <a
              href="#how"
              className="border border-rule-strong px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim hover:border-ink-faint hover:text-ink"
            >
              See what it does
            </a>
          </div>


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


        <section id="faq" className="border-t border-rule">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 className="text-[22px] font-medium tracking-[-0.01em] text-ink">Questions</h2>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink-faint">
                Answered about this build, not about a roadmap.
              </p>
            </div>

            <dl className="divide-y divide-rule border-y border-rule">
              {FAQ.map((entry) => (
                <div key={entry.q} className="py-5">
                  <dt className="text-[14px] text-ink">{entry.q}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-ink-dim">{entry.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="limits" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-[22px] font-medium tracking-[-0.01em] text-ink">
                Deliberate limits
              </h2>
              <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-dim">
                The database and hosting are on free tiers. These are the numbers those tiers
                allow, and they are on this page before anyone signs in.
              </p>
              <p className="mt-4 max-w-md text-[13px] leading-relaxed text-ink-faint">
                JavaScript, TypeScript, Python and SQL run in the browser. Everything else
                is edited, coloured and checked but not executed, because that would mean sending
                your code to a server.
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
              href={signedIn ? "/app" : "/login"}
              className="border border-accent bg-accent px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white sm:ml-auto"
            >
              {signedIn ? "Open the app" : "Continue with Google"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 sm:flex-row sm:items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Nested
          </span>
          <nav className="flex items-center gap-5 sm:ml-auto">
            <Link
              href="/privacy"
              className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              Terms
            </Link>
            <Link
              href="/security"
              className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              Security
            </Link>
            <Link
              href="/copyright"
              className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              Copyright
            </Link>
            <Link
              href="/dmca"
              className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint hover:text-ink"
            >
              DMCA
            </Link>
          </nav>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}

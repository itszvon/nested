import type { Metadata } from "next";
import Link from "next/link";
import { BackToTop } from "./back-to-top";
import { NestingDemo, VersionScrubber } from "./archive-demo";

export const metadata: Metadata = {
  title: "Nested · notes and code in folders inside folders",
  description:
    "Notes and code in one tree. Google sign-in, a code editor for twelve languages, and a saved version behind every save.",
  alternates: { canonical: "/home" },
  openGraph: {
    url: "/home",
    siteName: "Nested",
    type: "website",
    title: "Nested · notes and code in folders inside folders",
    description:
      "Notes and code in one tree. Google sign-in, a code editor for twelve languages, and a saved version behind every save.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Nested" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nested · notes and code in folders inside folders",
    description:
      "Notes and code in one tree. Google sign-in, a code editor for twelve languages, and a saved version behind every save.",
    images: ["/og.png"],
  },
};

const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. It runs on free database and hosting tiers, which is why the limits below exist. There is no paid plan.",
  },
  {
    q: "Can anyone else see my files?",
    a: "No. Every row is tied to your account in the database, and there is no sharing, public link, or guest mode anywhere in the product.",
  },
  {
    q: "Which languages actually run?",
    a: "JavaScript, TypeScript, Python and SQL run in your browser. HTML and CSS render a preview. JSON and YAML are parsed and checked, and Run prints the parsed result. Java, Go, Rust, C++ and Bash run in a sandboxed remote judge, so pressing Run sends that file off this machine for the run.",
  },
  {
    q: "What happens when I delete something?",
    a: "It moves to the trash, where it stays for thirty days with its version history intact. After that it is removed permanently.",
  },
  {
    q: "What if I close the tab with unsaved work?",
    a: "Unsaved edits are copied into this browser every half second. Reopening the file puts them back automatically, with an Undo button in the notice. Nothing is saved to the server until you press Save File.",
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
  ["Languages", "Python, JavaScript, TypeScript, Java, Go, Rust, C++, SQL, Bash, HTML/CSS, JSON, YAML"],
];

const LANGUAGES = [
  "Python",
  "TypeScript",
  "Rust",
  "Go",
  "Java",
  "C++",
  "SQL",
  "Bash",
  "HTML",
  "CSS",
  "JSON",
  "YAML",
];

const MARQUEE = [...LANGUAGES, ...LANGUAGES];

const STRUCTURE_POINTS = [
  ["Drag a row", "moves it, with its whole subtree"],
  ["F2", "renames in place"],
  ["Arrow keys", "walk the tree, Enter opens"],
];

const EDITOR_POINTS = [
  ["Runs here", "JavaScript, TypeScript, Python, SQL"],
  ["Preview only", "HTML and CSS, rendered live"],
  ["Remote judge", "Java, Go, Rust, C++, Bash"],
];

function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <rect x="2.75" y="2.75" width="18.5" height="18.5" />
      <rect x="7.5" y="7.5" width="9" height="9" />
      <rect x="11.25" y="11.25" width="1.5" height="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
    >
      <path d="M4.5 11.5 11.5 4.5M11.5 4.5H5.5M11.5 4.5v6" />
    </svg>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="square"
    >
      <path d="M3 4.5 6 7.5 9 4.5" />
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

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1.1"
    >
      <path d="M3.5 2h6L13 5.5V14h-9.5z" />
      <path d="M9.5 2v3.5H13" />
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

function NestMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="1.5" y="1.5" width="13" height="13" vectorEffect="non-scaling-stroke" />
      <rect x="5" y="5" width="6" height="6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TreeRow({
  name,
  depth,
  meta,
  kind,
  active,
  open,
}: {
  name: string;
  depth: number;
  meta: string;
  kind: "folder" | "file" | "note";
  active?: boolean;
  open?: boolean;
}) {
  return (
    <div
      className={`relative flex h-7 items-center gap-2 pr-2 text-[11px] ${
        active
          ? "bg-[rgba(255,107,69,0.09)] text-bright shadow-[inset_1px_0_0_var(--color-ember)]"
          : "text-mute hover:bg-raise/70"
      }`}
      style={{ paddingLeft: 10 + depth * 12 }}
    >
      {Array.from({ length: depth }).map((_, level) => (
        <span
          key={level}
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-hair"
          style={{ left: 10 + level * 12 }}
        />
      ))}
      <span className="flex w-3 justify-center text-ghost">
        {kind === "folder" ? (
          <Chevron className={`h-3 w-3 ${open ? "" : "-rotate-90"}`} />
        ) : null}
      </span>
      {kind === "folder" ? (
        <FolderIcon className="h-3 w-3 shrink-0 text-ghost" />
      ) : (
        <FileIcon className="h-3 w-3 shrink-0 text-ghost" />
      )}
      <span className="truncate">{name}</span>
      <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.08em] text-ghost">
        {meta}
      </span>
    </div>
  );
}

function CodeRow({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1.7rem_1fr] gap-2 pl-2">
      <span className="select-none text-right font-mono text-[9px] leading-[1.9] text-ghost/50">
        {n}
      </span>
      <code className="block overflow-hidden whitespace-pre font-mono text-[9.5px] leading-[1.9] text-mute">
        {children}
      </code>
    </div>
  );
}

function HeroWindow() {
  return (
    <div className="hero-window-wrap lg-in [animation-delay:260ms]">
      <div className="hero-window">
        <div className="flex h-10 items-center gap-3 border-b border-hair px-4">
          <Mark className="h-3.5 w-3.5 text-ember" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-bright">
            Nested
          </span>
          <span className="hidden font-mono text-[9px] text-ghost sm:inline">/ workspace</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="h-1 w-1 bg-ember" />
            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ghost">
              all changes saved
            </span>
          </span>
        </div>

        <div className="flex min-h-[352px]">
          <aside className="hidden w-[164px] shrink-0 border-r border-hair sm:block">
            <div className="flex h-8 items-center justify-between border-b border-hair px-3">
              <span className="lg-label text-[8px]!">files</span>
              <PlusIcon className="h-3 w-3 text-ghost" />
            </div>
            <TreeRow name="scratch.md" depth={0} meta="md" kind="note" />
            <TreeRow name="algorithms" depth={0} meta="3" kind="folder" open />
            <TreeRow name="graphs" depth={1} meta="2" kind="folder" open />
            <TreeRow name="dijkstra.py" depth={2} meta="py" kind="file" active />
            <TreeRow name="bellman.py" depth={2} meta="py" kind="file" />
            <TreeRow name="notes.md" depth={1} meta="md" kind="note" />
            <TreeRow name="systems" depth={0} meta="5" kind="folder" />
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex h-8 items-center gap-2.5 border-b border-hair px-3">
              <FileIcon className="h-3 w-3 text-ghost" />
              <span className="truncate text-[11px] text-bright">dijkstra.py</span>
              <span className="hidden font-mono text-[8.5px] uppercase tracking-[0.1em] text-ghost sm:inline">
                python
              </span>
              <span className="ml-auto font-mono text-[8.5px] tracking-[0.08em] text-ghost">
                rev 7
              </span>
            </div>

            <div className="py-2.5 [mask-image:linear-gradient(to_right,black_94%,transparent)]">
              <CodeRow n={1}>
                <span className="tok-k">from</span> heapq <span className="tok-k">import</span>{" "}
                heappop, heappush
              </CodeRow>
              <CodeRow n={2}>{""}</CodeRow>
              <CodeRow n={3}>
                <span className="tok-k">def</span> <span className="tok-f">shortest</span>(graph,
                start):
              </CodeRow>
              <CodeRow n={4}>
                {"    "}dist = {"{"}n: <span className="tok-f">float</span>(
                <span className="tok-s">&quot;inf&quot;</span>){"}"}
              </CodeRow>
              <CodeRow n={5}>
                {"    "}dist[start] = <span className="tok-n">0</span>
              </CodeRow>
              <CodeRow n={6}>
                {"    "}queue = [(<span className="tok-n">0</span>, start)]
              </CodeRow>
              <CodeRow n={7}>{""}</CodeRow>
              <CodeRow n={8}>
                {"    "}<span className="tok-k">while</span> queue:
              </CodeRow>
              <CodeRow n={9}>
                {"        "}d, node = <span className="tok-f">heappop</span>(queue)
              </CodeRow>
              <CodeRow n={10}>
                {"        "}<span className="tok-k">if</span> d {">"} dist[node]:
              </CodeRow>
              <CodeRow n={11}>
                {"            "}<span className="tok-k">continue</span>
              </CodeRow>
              <CodeRow n={12}>
                {"        "}<span className="tok-k">for</span> n, w{" "}
                <span className="tok-k">in</span> graph[node]:
              </CodeRow>
              <CodeRow n={13}>
                {"            "}alt = d + w
              </CodeRow>
              <CodeRow n={14}>
                {"            "}<span className="tok-k">if</span> alt {"<"} dist[n]:
              </CodeRow>
              <CodeRow n={15}>
                {"                "}dist[n] = alt
              </CodeRow>
              <CodeRow n={16}>
                {"                "}<span className="tok-f">heappush</span>(queue, (alt, n))
              </CodeRow>
            </div>

            <div className="flex h-8 items-center gap-4 border-t border-hair px-3 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ghost">
              <span>ln 8, col 12</span>
              <span className="ml-auto hidden sm:inline">spaces: 4</span>
              <span>utf-8</span>
            </div>
          </div>

          <aside className="hidden w-[146px] shrink-0 border-l border-hair xl:block">
            <div className="flex h-8 items-center justify-between border-b border-hair px-3">
              <span className="lg-label text-[8px]!">versions</span>
              <span className="font-mono text-[8px] text-ghost">17</span>
            </div>
            {[
              ["11:12", "now", "tighten the loop", true],
              ["10:44", "project", "add type hints", false],
              ["09:40", "save", "handle empty graph", false],
              ["09:12", "save", "first pass", false],
            ].map(([time, kind, message, current]) => (
              <div
                key={time as string}
                className={`relative border-b border-hair/70 py-2.5 pl-3 pr-2 ${
                  current ? "bg-[rgba(255,107,69,0.05)]" : ""
                }`}
              >
                {current ? (
                  <span className="absolute inset-y-0 left-0 w-px bg-ember" aria-hidden="true" />
                ) : null}
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[8.5px] tracking-[0.08em] text-ghost">{time}</span>
                  <span
                    className={`font-mono text-[7.5px] uppercase tracking-[0.1em] ${
                      current ? "text-ember" : "text-ghost/70"
                    }`}
                  >
                    {kind}
                  </span>
                </div>
                <p
                  className={`mt-1 truncate text-[10px] ${
                    current ? "text-bright" : "text-mute"
                  }`}
                >
                  {message}
                </p>
              </div>
            ))}
            <div className="px-3 py-2.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ghost">
              restore any save
            </div>
          </aside>
        </div>

        <div className="flex h-8 items-center gap-3 border-t border-hair px-4 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ghost">
          <span className="text-ember">python</span>
          <span>3 folders · 4 files</span>
          <span className="ml-auto">saved 11:12</span>
        </div>
      </div>
    </div>
  );
}

function EditorArtifact() {
  return (
    <div className="lg-panel">
      <div className="flex items-center gap-0 overflow-x-auto border-b border-hair">
        {["python", "typescript", "rust", "sql", "go"].map((language) => (
          <span
            key={language}
            className={`border-r border-hair px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] ${
              language === "rust" ? "bg-raise text-bright" : "text-ghost"
            }`}
          >
            {language}
          </span>
        ))}
        <span className="ml-auto hidden shrink-0 px-4 font-mono text-[8px] uppercase tracking-[0.1em] text-ghost sm:inline">
          flatten.rs
        </span>
      </div>

      <div className="py-4">
        <CodeRow n={1}>
          <span className="tok-k">pub fn</span> <span className="tok-f">flatten</span>(node:{" "}
          <span className="tok-k">&amp;</span>Node) -&gt; Vec{"<"}
          <span className="tok-k">String</span>{">"} {"{"}
        </CodeRow>
        <CodeRow n={2}>
          {"    "}<span className="tok-k">let mut</span> out = vec![node.name.
          <span className="tok-f">clone</span>()];
        </CodeRow>
        <CodeRow n={3}>{""}</CodeRow>
        <CodeRow n={4}>
          {"    "}<span className="tok-k">for</span> child{" "}
          <span className="tok-k">in</span> {"&"}node.children {"{"}
        </CodeRow>
        <CodeRow n={5}>
          {"        "}out.<span className="tok-f">extend</span>(
          <span className="tok-f">flatten</span>(child));
        </CodeRow>
        <CodeRow n={6}>{"    }"}</CodeRow>
        <CodeRow n={7}>{""}</CodeRow>
        <CodeRow n={8}>{"    "}out</CodeRow>
        <CodeRow n={9}>{"}"}</CodeRow>
        <CodeRow n={10}>{""}</CodeRow>
        <CodeRow n={11}>
          <span className="tok-c">{"// a folder is just a node with children"}</span>
        </CodeRow>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hair px-4 py-3 font-mono text-[8px] uppercase tracking-[0.1em] text-ghost">
        <span className="text-sage">formatted</span>
        <span>folding</span>
        <span>multi-cursor</span>
        <span>search</span>
        <span className="ml-auto">rust · 1.8 kb</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div id="top" className="landing min-h-dvh">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Nested",
            url: "https://nestedforyou.vercel.app/home",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any",
            description:
              "Private notes and code in folders inside folders, with a code editor and a saved version behind every save.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        }}
      />

      <header className="sticky top-0 z-50 border-b border-hair bg-void/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-8 px-6 md:px-10">
          <Link href="/home" className="flex items-center gap-3" aria-label="Nested, home">
            <Mark className="h-5 w-5 text-ember" />
            <span className="text-[12px] font-medium uppercase tracking-[0.26em] text-bright">
              Nested
            </span>
          </Link>

          <nav className="hidden h-full items-center gap-7 md:flex" aria-label="Primary">
            <a href="#structure" className="lg-link text-[10px] uppercase tracking-[0.14em]">
              How it works
            </a>
            <a href="#limits" className="lg-link text-[10px] uppercase tracking-[0.14em]">
              Limits
            </a>
            <a href="#faq" className="lg-link text-[10px] uppercase tracking-[0.14em]">
              FAQ
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-6">
            <span className="hidden items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost lg:flex">
              <span className="h-1 w-1 bg-sage" aria-hidden="true" />
              private by default
            </span>
            <Link href="/app" className="lg-button-primary">
              Open app
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <nav
          className="flex items-center gap-6 border-t border-hair px-6 py-2.5 md:hidden"
          aria-label="Primary, mobile"
        >
          <a href="#structure" className="font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
            How it works
          </a>
          <a href="#limits" className="font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
            Limits
          </a>
          <a href="#faq" className="font-mono text-[9px] uppercase tracking-[0.14em] text-mute">
            FAQ
          </a>
          <span className="ml-auto h-1 w-1 bg-sage" aria-hidden="true" />
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="hero-bloom" aria-hidden="true" />
          <div className="mx-auto max-w-[1240px] px-6 pb-20 pt-16 md:px-10 lg:pb-28 lg:pt-24">
            <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
              <div>
                <h1 className="lg-in text-[clamp(3.1rem,7.6vw,5.75rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-bright">
                  Notes and code,
                  <span className="relative mt-1 block w-fit text-ember">
                    nested.
                    <svg
                      viewBox="0 0 300 14"
                      fill="none"
                      aria-hidden="true"
                      className="absolute -bottom-1 left-0 h-3 w-full text-ember/50"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M2 9.5C74 3.5 166 2.5 298 7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </h1>

                <p className="lg-in mt-8 max-w-[45ch] text-[15px] leading-[1.7] text-mute [animation-delay:120ms]">
                  A private workspace for the drafts, snippets and half-finished files that do not
                  belong in a repository. Folders go as deep as the work does. Every save leaves a
                  version you can go back to.
                </p>

                <div className="lg-in mt-9 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
                  <Link href="/app" className="lg-button-primary">
                    Open the app
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <a href="#structure" className="lg-button-ghost">
                    See what it does
                  </a>
                </div>

                <p className="lg-in mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost [animation-delay:240ms]">
                  <span className="flex items-center gap-2">
                    <span className="h-1 w-1 bg-ember" aria-hidden="true" />
                    Google sign-in
                  </span>
                  <span className="hidden h-3 w-px bg-hair-strong sm:block" aria-hidden="true" />
                  <span>No sharing, ever</span>
                  <span className="hidden h-3 w-px bg-hair-strong sm:block" aria-hidden="true" />
                  <span>Dark by default</span>
                </p>
              </div>

              <div aria-hidden="true">
                <HeroWindow />
              </div>
            </div>
          </div>
        </section>

        <div className="lg-marquee relative overflow-hidden border-y border-hair bg-void/60 py-4 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <div className="lg-marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                {MARQUEE.map((language, index) => (
                  <span key={`${copy}-${language}-${index}`} className="flex items-center">
                    <span className="px-7 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                      {language}
                    </span>
                    <span className="text-ember/70" aria-hidden="true">
                      /
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section id="structure" className="scroll-mt-28 border-b border-hair md:scroll-mt-20">
          <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-10 md:py-32">
            <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
              <div className="lg-reveal">
                <h2 className="text-[clamp(2.1rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-bright">
                  Folders
                  <br />
                  inside folders.
                </h2>
                <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.7] text-mute">
                  Projects sit at the top. Inside one, folders go inside folders with no depth
                  limit. It is the one structure everyone already understands, with none of the
                  commit workflow wrapped around it.
                </p>

                <dl className="mt-10 max-w-md border-y border-hair">
                  {STRUCTURE_POINTS.map(([action, detail]) => (
                    <div
                      key={action}
                      className="flex items-baseline justify-between gap-6 border-b border-hair py-3.5 last:border-b-0"
                    >
                      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-bright">
                        {action}
                      </dt>
                      <dd className="text-right text-[12px] text-ghost">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="lg-reveal lg:pl-4">
                <NestingDemo />
              </div>
            </div>
          </div>
        </section>

        <section id="editor" className="scroll-mt-28 border-b border-hair md:scroll-mt-20">
          <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-10 md:py-32">
            <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
              <div className="order-2 lg:order-1 lg-reveal">
                <EditorArtifact />
              </div>

              <div className="order-1 lg:order-2 lg-reveal">
                <h2 className="text-[clamp(2.1rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-bright">
                  Twelve languages,
                  <br />
                  one editor.
                </h2>
                <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.7] text-mute">
                  Colouring, bracket matching, folding, search, several cursors and a format
                  button, in a window that behaves like the editor you already use. No plugin to
                  install, no project to configure.
                </p>

                <dl className="mt-9 max-w-md divide-y divide-hair border-y border-hair">
                  {EDITOR_POINTS.map(([label, detail]) => (
                    <div key={label} className="flex items-baseline justify-between gap-6 py-3">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ember">
                        {label}
                      </dt>
                      <dd className="text-right text-[12px] text-ghost">{detail}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-8 flex flex-wrap gap-2">
                  {LANGUAGES.map((language) => (
                    <span key={language} className="lang-chip">
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="history" className="scroll-mt-28 border-b border-hair md:scroll-mt-20">
          <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-10 md:py-32">
            <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
              <div className="lg-reveal">
                <h2 className="text-[clamp(2.1rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-bright">
                  A version behind
                  <br />
                  every save.
                </h2>
                <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.7] text-mute">
                  Save File records one file. Save Project records every changed file at once.
                  Versions are immutable, so the list is a history rather than a snapshot you have
                  to remember to take.
                </p>
                <p className="mt-5 max-w-[46ch] text-[13.5px] leading-[1.7] text-ghost">
                  Drag the scrubber. Any version can go back into the editor, and nothing changes
                  until you save again.
                </p>
              </div>

              <div className="lg-reveal lg:pr-4">
                <VersionScrubber />
              </div>
            </div>
          </div>
        </section>

        <section id="limits" className="scroll-mt-28 border-b border-hair md:scroll-mt-20">
          <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-10 md:py-32">
            <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
              <div className="lg-reveal">
                <h2 className="text-[clamp(2.1rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-bright">
                  Small
                  <br />
                  on purpose.
                </h2>
                <p className="mt-7 max-w-[42ch] text-[15px] leading-[1.7] text-mute">
                  The database and hosting are on free tiers. These are the numbers those tiers
                  allow, and they are on this page before anyone signs in.
                </p>
                <p className="mt-5 max-w-[42ch] text-[13.5px] leading-[1.7] text-ghost">
                  JavaScript, TypeScript, Python and SQL run in the browser. HTML and CSS preview.
                  Java, C++, Go, Rust and Bash run in a remote sandbox, so only those files leave
                  your machine, only when you press Run.
                </p>
              </div>

              <dl className="lg-reveal border-t border-hair-strong">
                {LIMITS.map(([label, value]) => (
                  <div
                    key={label}
                    className="-mx-3 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] items-baseline gap-6 border-b border-hair px-3 py-4 transition-colors hover:bg-raise/50"
                  >
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost">
                      {label}
                    </dt>
                    <dd className="text-right text-[13px] text-bright">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 border-b border-hair md:scroll-mt-20">
          <div className="mx-auto max-w-[1240px] px-6 py-24 md:px-10 md:py-32">
            <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
              <div className="lg-reveal">
                <h2 className="text-[clamp(2.1rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-bright">
                  Questions,
                  <br />
                  answered.
                </h2>
                <p className="mt-7 max-w-[34ch] text-[14px] leading-[1.7] text-ghost">
                  Answered about this build, not about a roadmap.
                </p>
              </div>

              <div className="lg-reveal border-t border-hair-strong">
                {FAQ.map((entry) => (
                  <details key={entry.q} className="faq-item border-b border-hair">
                    <summary className="flex items-start justify-between gap-8 py-5 text-[15px] text-mute transition-colors hover:text-bright">
                      <span>{entry.q}</span>
                      <PlusIcon className="faq-plus mt-0.5 h-4 w-4 shrink-0 text-ghost" />
                    </summary>
                    <p className="max-w-[62ch] pb-6 pr-10 text-[13.5px] leading-[1.75] text-mute">
                      {entry.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-hair">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(50%_100%_at_50%_100%,rgba(255,107,69,0.18),transparent_72%)]"
          />
          <div className="relative mx-auto max-w-[1240px] px-6 py-24 md:px-10 md:py-36">
            <NestMark className="pointer-events-none absolute -right-6 -top-8 hidden h-[300px] w-[300px] text-bright/[0.04] lg:block" />
            <div className="grid items-end gap-12 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="lg-reveal">
                <h2 className="text-[clamp(2.5rem,6.2vw,5rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-bright">
                  Start with an
                  <br />
                  empty project.
                </h2>
                <p className="mt-7 max-w-[42ch] text-[15px] leading-[1.7] text-mute">
                  One click to sign in, one to make the first folder. Then paste the thing you have
                  been keeping in a scratch tab.
                </p>
              </div>

              <div className="lg-reveal flex flex-col items-start gap-5 lg:items-end">
                <Link href="/app" className="lg-button-primary">
                  Open the app
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost lg:text-right">
                  Google sign-in · no credit card
                  <br />
                  no sharing · no light mode
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto max-w-[1240px] px-6 py-12 md:px-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Mark className="h-4 w-4 text-ember" />
                <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-bright">
                  Nested
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ghost">
                Notes and code, in folders inside folders.
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-7 gap-y-3" aria-label="Legal">
              {[
                ["/privacy", "Privacy"],
                ["/terms", "Terms"],
                ["/security", "Security"],
                ["/copyright", "Copyright"],
                ["/dmca", "DMCA"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="font-mono text-[9px] uppercase tracking-[0.12em] text-ghost transition-colors hover:text-bright"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-hair pt-6 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ghost/80 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Nested</span>
            <span>Dark by default</span>
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}

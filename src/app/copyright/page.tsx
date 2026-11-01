import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Copyright · Nested",
  description: "Who owns what in Nested: your files, the interface, and third-party components.",
  robots: { index: true, follow: true },
};

export default function CopyrightPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/home"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
      >
        ← Nested
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-ink">Copyright</h1>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Your content
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          Everything you store remains yours. Storing it grants {OPERATOR} no licence to publish,
          reuse, or distribute it. It is not read except to operate the service.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        The application
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          The interface, its copy, and the code written for it belong to the operator. Using the
          service grants no licence to redistribute the application.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Third-party components
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          The application is built on open-source software: Next.js (MIT), React (MIT), CodeMirror
          (MIT), Prettier (MIT), Sucrase (MIT), sql.js (MIT), Pyodide (MPL-2.0) and Tailwind CSS
          (MIT), with Sentry&apos;s SDK under its own licence. Fonts are Geist, served through the
          framework. Each remains under its own licence and copyright.
        </p>
        <p>
          No stock photography, AI-generated imagery, or third-party illustration appears in the
          interface. The three icons are drawn in the repository.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Claims on this site
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          The landing page claims only what the product does: ten languages, the storage limits,
          which languages execute in the browser, and which do not. There are no testimonials,
          customers, benchmarks or research findings, so there is nothing to cite. Every sentence on
          the site was written for it.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Complaints
      </h2>
      <div className="mt-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          If you believe something here infringes your copyright, email{" "}
          <a className="text-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . The{" "}
          <Link className="text-ink underline" href="/dmca">
            DMCA policy
          </Link>{" "}
          describes what a notice must contain.
        </p>
      </div>

      <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
        Last updated 31 October 2026
      </p>
    </main>
  );
}

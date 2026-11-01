import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms · Nested",
  description: "The terms for using Nested.",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{title}</h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/home"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
      >
        ← Nested
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-ink">Terms</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">
        Plain terms for a small, free tool. Written by the developer, not a lawyer.
      </p>

      <Section title="What this is">
        <p>
          {OPERATOR} is a private place to store text and code. It is offered free of charge and
          without any service guarantee. Features may change or be withdrawn.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You sign in with a Google account and are responsible for that account and everything done
          through it. One person, one account. Do not share access or attempt to reach another
          person&apos;s data.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          Everything you store remains yours. You grant nothing beyond the permission needed to
          store and display it back to you. Do not use the service for unlawful content, malware, or
          material you have no right to keep.
        </p>
      </Section>

      <Section title="Limits">
        <p>
          2 MB per file, 25 MB per account, 2,000 files, 500 folders. Exceeding a limit is refused
          with a message rather than silently truncated. Trash is emptied after thirty days.
        </p>
      </Section>

      <Section title="Backups">
        <p>
          Do not treat this as your only copy of anything important. Deletion is immediate once
          trash is emptied, and a hosted database can fail. Keep your own copy of anything you
          cannot afford to lose.
        </p>
      </Section>

      <Section title="Ending use">
        <p>
          You may stop using the service at any time. To have your account and content removed,
          email{" "}
          <a className="text-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . Access may be withdrawn for abuse or for anything that puts the service or its users at
          risk.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          The service is provided as is, with no warranty, and without liability for lost data or
          lost time, to the extent the law allows.
        </p>
      </Section>

      <Section title="Changes">
        <p>Material changes will be reflected here with a new date. This version: 31 October 2026.</p>
      </Section>
    </main>
  );
}

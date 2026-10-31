import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security policy · Nested",
  description: "How to report a security issue in Nested, and what to expect.",
  robots: { index: true, follow: true },
};

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/home"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
      >
        ← Nested
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-ink">Security policy</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">
        {OPERATOR} is a small, free service run by one person. This page says how to report a
        problem and what happens next, without promising a response time it cannot keep.
      </p>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Reporting a vulnerability
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          Email{" "}
          <a className="text-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . Include what you did, what happened, and what you expected. A minimal reproduction is
          worth more than a long report.
        </p>
        <p>
          Please do not test against other people's accounts, do not run automated scanners against
          the service, and do not publish a working exploit before it is fixed. Test against your
          own account only.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        What is in scope
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          The deployed application, the database access rules, and the authentication flow. Out of
          scope: findings that require a compromised device, findings in third-party services
          (report those to Supabase, Vercel or Google), and reports produced only by an automated
          scanner without a demonstrated impact.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        What to expect
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          An acknowledgement when the report is read, a statement of whether it is accepted, and a
          fix when one is possible. No bounty is offered and no fixed deadline is promised. If a
          report affects stored data, the affected account is told.
        </p>
        <p>
          There is no formal bug bounty programme, no security certification, and no penetration
          test has been performed on this service.
        </p>
      </div>

      <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
        Last updated 31 October 2026
      </p>
    </main>
  );
}

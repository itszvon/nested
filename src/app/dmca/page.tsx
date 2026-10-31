import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "DMCA policy · Nested",
  description: "How copyright complaints are handled for content stored in Nested.",
  robots: { index: true, follow: true },
};

export default function DmcaPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/home"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
      >
        ← Nested
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-ink">DMCA policy</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">
        {OPERATOR} stores files for its users. It does not publish them, index them, or show them to
        anyone but their owner, and there is no public sharing feature. A notice is still handled if
        one arrives.
      </p>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        Designated agent
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          Copyright notices go to{" "}
          <a className="text-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . No postal address is published, and no agent has been registered with the US Copyright
          Office.
        </p>
      </div>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        What a notice must contain
      </h2>
      <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-dim">
        <li>Identification of the copyrighted work you claim is infringed.</li>
        <li>
          Enough information to locate the material, such as the account it belongs to. Content is
          private, so a notice that names only a file name may not be actionable.
        </li>
        <li>Your contact details.</li>
        <li>
          A statement that you believe the use is not authorised by the owner, its agent, or the
          law.
        </li>
        <li>
          A statement, under penalty of perjury, that the information is accurate and that you are
          the owner or authorised to act for them.
        </li>
        <li>Your physical or electronic signature.</li>
      </ul>

      <h2 className="mt-10 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        What happens next
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-ink-dim">
        <p>
          A complete notice is reviewed, and where it is valid the material is removed and the
          account holder is told, with the notice attached. An incomplete notice is returned with
          the missing parts named.
        </p>
        <p>
          Counter notices are accepted on the same address. Repeated infringement by one account
          leads to that account being closed.
        </p>
      </div>

      <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
        Last updated 31 October 2026
      </p>
    </main>
  );
}

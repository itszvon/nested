import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Nested",
  description: "What Nested stores, where it goes, and how to have it removed.",
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

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/home"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
      >
        ← Nested
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-ink">Privacy</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">
        This page describes what this build of Nested actually does. It was written by the
        developer, not a lawyer, and it has not been reviewed by one.
      </p>

      <Section title="What we store">
        <p>
          When you sign in with Google, we receive your email address and display name. We store
          your email, a username generated from it, and the display name Google returns.
        </p>
        <p>
          We store everything you create: folders, files, their contents, and every saved version.
          Deleted items stay in a trash table for thirty days, then are permanently removed.
        </p>
        <p>
          Nothing else. There are no analytics, advertising pixels, or third-party trackers on any
          page.
        </p>
      </Section>

      <Section title="Where it lives">
        <p>
          Content and account records are stored in a Supabase Postgres database in the East US
          region. The application is served by Vercel. Google handles the sign-in itself. If error
          reporting is enabled, stack traces and request metadata go to Sentry, with request bodies
          stripped before sending.
        </p>
        <p>
          While you type, unsaved edits are copied to IndexedDB inside your own browser. That copy
          never leaves the device and is deleted when you save or discard.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          One cookie: the session cookie set by Supabase Auth when you sign in. It is HttpOnly,
          SameSite=Lax, and Secure in production. Nothing else is set, which is why there is no
          cookie banner.
        </p>
      </Section>

      <Section title="Who can read it">
        <p>
          Only you. Row-level security in the database ties every row to your account id, and the
          application has no sharing feature and no administrative interface. The operator can reach
          the database directly, as with any hosted service.
        </p>
      </Section>

      <Section title="How long">
        <p>
          Trash: thirty days, then purged. Versions: until you delete them. Everything else: until
          you ask for the account to be removed.
        </p>
      </Section>

      <Section title="Removing your data">
        <p>
          There is no delete-account button yet. Email{" "}
          <a className="text-ink underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          from the address you signed in with and the account, its files, and its versions are
          removed from the database. Deleting individual files and folders is available in the app.
        </p>
      </Section>

      <Section title="Who runs it">
        <p>{OPERATOR}, operated by the address above. No company entity is registered for it.</p>
      </Section>

      <Section title="Children">
        <p>Nested is not intended for anyone under 13.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this page changes materially, the date below changes with it. This version was written
          on 31 October 2026.
        </p>
      </Section>
    </main>
  );
}

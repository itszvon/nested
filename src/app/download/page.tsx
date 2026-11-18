import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";

/**
 * Download page.
 *
 * The binaries live on GitHub Releases, so this page links to the stable
 * release URL for the current version rather than re-hosting 120 MB files.
 * Hashes and changelog live in the release notes that ship with the build.
 */

const VERSION = "0.1.1";
const RELEASES = "https://github.com/itszvon/nested/releases";
const TAG = `desktop-v${VERSION}`;
const INSTALLER = `${RELEASES}/download/${TAG}/Nested-Setup-${VERSION}.exe`;
const PORTABLE = `${RELEASES}/download/${TAG}/Nested-Portable-${VERSION}.exe`;

export const metadata: Metadata = {
  title: "Download · Nested",
  description: "Nested for Windows: the same private notes app, installed.",
  alternates: { canonical: `${SITE_URL}/download` },
  openGraph: {
    title: "Download Nested",
    description: "Nested for Windows: the same private notes app, installed.",
    url: `${SITE_URL}/download`,
  },
};

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/home"
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint hover:text-ink"
      >
        ← Nested
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.02em] text-ink">
        Nested for Windows
      </h1>
      <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ink-dim">
        The same app, installed. Your files still live in your account, so the
        desktop and the website show the same thing.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={INSTALLER}
          className="border border-accent bg-accent px-5 py-3 text-[13px] font-medium text-white transition-colors hover:bg-accent-dim"
        >
          Download installer (122 MB)
        </a>
        <a
          href={PORTABLE}
          className="border border-rule px-5 py-3 text-[13px] text-ink transition-colors hover:border-rule-strong"
        >
          Portable, no install (109 MB)
        </a>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        Version {VERSION} · Windows 10 22H2 and 11 · x64
      </p>

      <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-accent-text">
        Builds are hosted on GitHub, and that repository is private while 0.1.x is
        unsigned. Downloading needs a GitHub account with access; ask and it will be
        granted.
      </p>

      <section className="mt-10 border-l-2 border-accent pl-4">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">
          Windows will warn you
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
          This build is unsigned, so SmartScreen says the publisher is unknown.
          Click <span className="text-ink">More info</span> then{" "}
          <span className="text-ink">Run anyway</span>. Signed builds arrive once
          a certificate is in place; until then you are trusting this download,
          which is why the checksums are published.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Install
        </h2>
        <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-dim">
          <li>1. Run the installer. It installs for your user, no admin needed.</li>
          <li>2. Open Nested and press Continue with Google.</li>
          <li>3. Your browser opens for sign-in, then hands you back to the app.</li>
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Details
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-dim">
          <li>
            Installs to{" "}
            <code className="text-ink">%LOCALAPPDATA%\Programs\Nested</code>, about
            250 MB on disk.
          </li>
          <li>Needs a network connection: nothing is stored on the machine.</li>
          <li>
            Updates check in the background and wait until you have nothing unsaved.
          </li>
          <li>
            <a className="text-ink underline decoration-rule-strong underline-offset-2" href={`${RELEASES}/tag/${TAG}`}>
              Release notes and SHA-256 checksums
            </a>
          </li>
          <li>
            <a className="text-ink underline decoration-rule-strong underline-offset-2" href={RELEASES}>
              All releases
            </a>
          </li>
        </ul>
      </section>

      <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        Prefer the browser? <Link href="/app" className="text-ink underline underline-offset-2">Open the app</Link>
      </p>
    </main>
  );
}

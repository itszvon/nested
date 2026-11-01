import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Notes and code, in folders inside folders.";

/**
 * Shared defaults. Individual pages opt out of indexing; marking the whole
 * site `noindex` here used to keep even the landing page out of search.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Nested",
  description,
  verification: { google: "Ea4v9isTQNptdMltRSawC9a7Lzqa42cBcs9JLQUy8dM" },
  openGraph: {
    type: "website",
    siteName: "Nested",
    title: "Nested",
    description,
    url: "/home",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Nested" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nested",
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (dark-mode shims especially) rewrite attributes on
    // <html> and <body> before React hydrates. Without this, every load throws
    // a hydration mismatch and the dev overlay reloads in a loop.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-neutral-950 text-neutral-100"
      >
        {children}
      </body>
    </html>
  );
}

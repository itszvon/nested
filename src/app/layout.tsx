import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nested",
  description: "Notes and code, in folders inside folders.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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

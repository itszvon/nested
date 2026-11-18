import { Suspense } from "react";
import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = {
  title: "Sign in · Nested",
  robots: { index: false, follow: false },
};

const ERROR_COPY: Record<string, string> = {
  unavailable: "Google sign-in is unavailable right now. Try again in a moment.",
  exchange: "That sign-in link expired. Try again.",
  missing_code: "Google did not return a sign-in code. Try again.",
};

type SearchParams = Promise<{ error?: string }>;

async function SignInError({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const message = error ? ERROR_COPY[error] : undefined;

  if (!message) return null;

  return (
    <p role="alert" className="mt-6 border-l-2 border-accent pl-3 text-[13px] text-accent-text">
      {message}
    </p>
  );
}

/** The mark from the app icon: two squares, one inside the other. */
function Mark() {
  return (
    <svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true" className="block">
      <rect x="6.5" y="6.5" width="19" height="19" fill="none" stroke="var(--color-ink)" strokeWidth="1.6" />
      <rect x="12" y="12" width="8" height="8" fill="none" stroke="var(--color-accent-text)" strokeWidth="1.6" />
    </svg>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const configured = isSupabaseConfigured();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ground px-6">
      {/* Blueprint grid, faded at the edges so it never competes with the copy. */}
      <div aria-hidden="true" className="signin-grid pointer-events-none absolute inset-0" />

      {/* Nested squares, drifting very slowly, echoing the product name. */}
      <div aria-hidden="true" className="signin-rings pointer-events-none absolute -right-48 -top-48 h-[620px] w-[620px]">
        <span className="absolute inset-0 border border-rule-strong" />
        <span className="absolute inset-[14%] border border-accent/45" />
        <span className="absolute inset-[28%] border border-rule-strong" />
        <span className="absolute inset-[42%] border border-accent/25" />
      </div>

      {/* Low ember glow behind the form: light from below. */}
      <div aria-hidden="true" className="signin-glow pointer-events-none absolute inset-0" />

      <div className="relative z-10 w-full max-w-sm">
        <Mark />

        <h1 className="mt-7 text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink">
          Nested
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
          Notes and code, in folders inside folders.
        </p>

        <div aria-hidden="true" className="mt-7 h-px w-14 bg-accent" />

        <Suspense fallback={null}>
          <SignInError searchParams={searchParams} />
        </Suspense>

        {configured ? (
          <form action={signInWithGoogle} className="mt-7">
            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-3 border border-accent bg-accent px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-accent-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            >
              <span
                aria-hidden="true"
                className="grid h-5 w-5 place-items-center border border-white/40 font-mono text-[10px] leading-none"
              >
                G
              </span>
              Continue with Google
            </button>

            <p className="mt-4 text-[12px] leading-relaxed text-ink-dim">
              Google is the only way in. Your files are private to your account.
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.08em] text-ink-faint">
              By continuing you agree to the{" "}
              <a className="underline decoration-rule-strong underline-offset-2 hover:text-ink" href="/terms">
                Terms
              </a>{" "}
              and the{" "}
              <a className="underline decoration-rule-strong underline-offset-2 hover:text-ink" href="/privacy">
                Privacy policy
              </a>
              .
            </p>
          </form>
        ) : (
          <div className="mt-7 border border-rule bg-panel/60 p-4 text-[13px] leading-relaxed text-ink-dim">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink">Setup needed</p>
            <p className="mt-2">
              Copy <code className="text-ink">.env.example</code> to{" "}
              <code className="text-ink">.env.local</code> and fill in the Supabase URL and
              publishable key. Steps are in the README.
            </p>
          </div>
        )}

        <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
          Private by default · no tracking · export any time
        </p>
      </div>
    </main>
  );
}

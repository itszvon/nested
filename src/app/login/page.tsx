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
    <p
      role="alert"
      className="mt-6 border-l-2 border-red-500 pl-3 text-sm text-red-300"
    >
      {message}
    </p>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = isSupabaseConfigured();

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Nested</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Notes and code, in folders inside folders.
        </p>

        {/* Streamed so the page shell stays static. */}
        <Suspense fallback={null}>
          <SignInError searchParams={searchParams} />
        </Suspense>

        {configured ? (
          <form action={signInWithGoogle} className="mt-8">
            <button
              type="submit"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-medium transition-colors hover:border-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300"
            >
              Continue with Google
            </button>
            <p className="mt-4 text-xs leading-relaxed text-ink-dim">
              Google is the only way in. Your files are private to your account.
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              By continuing you agree to the{" "}
              <a className="underline hover:text-neutral-400" href="/terms">Terms</a> and the{" "}
              <a className="underline hover:text-neutral-400" href="/privacy">Privacy policy</a>.
            </p>
          </form>
        ) : (
          <div className="mt-8 rounded-md border border-neutral-800 bg-neutral-900/60 p-4 text-sm leading-relaxed text-neutral-300">
            <p className="font-medium text-neutral-100">Setup needed</p>
            <p className="mt-2">
              Copy <code className="text-neutral-200">.env.example</code> to{" "}
              <code className="text-neutral-200">.env.local</code> and fill in the
              Supabase URL and publishable key. Steps are in the README.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

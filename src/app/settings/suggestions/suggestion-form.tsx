"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitSuggestion } from "./actions";

export type SuggestionRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  created_at: string;
};

export const STATUS_LABEL: Record<string, string> = {
  new: "received",
  reviewing: "reviewing",
  planned: "planned",
  shipped: "shipped",
  declined: "not planned",
};

const STATUS_TONE: Record<string, string> = {
  new: "border-rule-strong text-ink-dim",
  reviewing: "border-[var(--color-accent)]/50 text-[var(--color-accent-text)]",
  planned: "border-[var(--color-accent)]/50 text-[var(--color-accent-text)]",
  shipped: "border-emerald-800 text-emerald-300",
  declined: "border-rule text-ink-faint",
};

const CATEGORIES: Array<[string, string]> = [
  ["feature", "A feature"],
  ["bug", "A bug"],
  ["performance", "Speed"],
  ["design", "Design"],
  ["content", "Wording or docs"],
  ["other", "Something else"],
];

const field =
  "w-full border border-rule bg-ground px-3 py-2 text-[13px] text-ink outline-none focus:border-accent";
const label = "block font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint mb-1.5";

function when(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function SuggestionForm({ suggestions }: { suggestions: SuggestionRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("feature");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);

    const result = await submitSuggestion({ title, body, category });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setTitle("");
    setBody("");
    setCategory("feature");
    setSent(true);
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <form onSubmit={send} className="space-y-4">
        <div>
          <label htmlFor="suggestion-title" className={label}>
            Title
          </label>
          <input
            id="suggestion-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="What should be better?"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="suggestion-category" className={label}>
            Kind
          </label>
          <select
            id="suggestion-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={`${field} h-9 py-0`}
          >
            {CATEGORIES.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="suggestion-body" className={label}>
            Details
          </label>
          <textarea
            id="suggestion-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            required
            rows={6}
            placeholder="What you expected, what happened, and why it matters. Screenshots cannot be attached here, but a precise description is enough."
            className={`${field} resize-y leading-relaxed`}
          />
          <p className="mt-1 text-right font-mono text-[9px] text-ink-faint">
            {body.length} / 4000
          </p>
        </div>

        {error ? (
          <p role="alert" className="border-l-2 border-red-500 pl-3 text-[12px] text-red-300">
            {error}
          </p>
        ) : null}
        {sent ? (
          <p role="status" className="border-l-2 border-emerald-600 pl-3 text-[12px] text-emerald-300">
            Sent. You can follow its status below.
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="h-8 border border-accent bg-accent px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send suggestion"}
          </button>
          <span className="text-[11px] text-ink-faint">
            Only the operator can read the inbox. Other users never see this.
          </span>
        </div>
      </form>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Your suggestions
        </h2>

        {suggestions.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-dim">
            Nothing sent yet. If something in the app wastes your time, this is the place.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {suggestions.map((item) => (
              <li key={item.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="text-[13px] text-ink">{item.title}</p>
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                      STATUS_TONE[item.status] ?? "border-rule text-ink-faint"
                    }`}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                    {when(item.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-dim">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

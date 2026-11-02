"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSuggestion, updateSuggestion } from "./actions";
import { STATUS_LABEL } from "../suggestions/suggestion-form";

export type AdminSuggestion = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  username: string;
  email: string | null;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  created_at: string;
  storage_bytes: number;
  files: number;
  last_activity: string | null;
};

export type AdminOverview = {
  users: number;
  admins: number;
  files: number;
  folders: number;
  versions: number;
  storage_bytes: number;
  open_suggestions: number;
  errors_24h: number;
  suggestions: Record<string, number>;
};

const STATUSES = ["new", "reviewing", "planned", "shipped", "declined"] as const;

const STATUS_TONE: Record<string, string> = {
  new: "text-ink",
  reviewing: "text-[var(--color-accent-text)]",
  planned: "text-[var(--color-accent-text)]",
  shipped: "text-emerald-300",
  declined: "text-ink-faint",
};

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 104857.6) / 10} MB`;
}

function when(iso: string | null) {
  if (!iso) return "never";
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-rule bg-panel/40 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p className="mt-1 font-mono text-[18px] text-ink">{value}</p>
    </div>
  );
}

function SuggestionCard({ item }: { item: AdminSuggestion }) {
  const router = useRouter();
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(nextStatus = status) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await updateSuggestion({ id: item.id, status: nextStatus, note });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(nextStatus);
    setSaved(true);
    router.refresh();
    window.setTimeout(() => setSaved(false), 1500);
  }

  async function remove() {
    if (!window.confirm("Delete this suggestion permanently?")) return;
    setBusy(true);
    const result = await deleteSuggestion(item.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className="border border-rule bg-panel/30 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[13px] text-ink">{item.title}</p>
        <span className="border border-rule px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {item.category}
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {when(item.created_at)}
        </span>
      </div>

      <p className="mt-1 font-mono text-[10px] text-ink-faint">
        {item.username}
        {item.email ? ` · ${item.email}` : ""}
      </p>

      <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-dim">
        {item.body}
      </p>

      <div className="mt-3 flex flex-wrap items-start gap-3">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
            status
          </span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={`h-7 border border-rule bg-ground px-2 font-mono text-[10px] uppercase tracking-[0.08em] outline-none focus:border-accent ${STATUS_TONE[status] ?? ""}`}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value] ?? value}
              </option>
            ))}
          </select>
        </label>

        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Private note (not shown to the user)"
          maxLength={2000}
          className="h-7 min-w-[220px] flex-1 border border-rule bg-ground px-2 text-[12px] text-ink outline-none focus:border-accent"
        />

        <button
          type="button"
          onClick={() => save()}
          disabled={busy}
          className="h-7 border border-accent bg-accent px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white disabled:opacity-40"
        >
          {busy ? "saving" : saved ? "saved" : "save"}
        </button>

        {status !== "new" ? (
          <button
            type="button"
            onClick={() => save("new")}
            disabled={busy}
            className="h-7 border border-rule px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:border-rule-strong hover:text-ink disabled:opacity-40"
          >
            reopen
          </button>
        ) : null}

        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="h-7 border border-rule px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:border-red-800 hover:text-red-300 disabled:opacity-40"
        >
          delete
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[11px] text-red-300">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function AdminPanel({
  overview,
  suggestions,
  users,
  errors,
}: {
  overview: AdminOverview;
  suggestions: AdminSuggestion[];
  users: AdminUser[];
  errors: Array<{ id: string; source: string; message: string; path: string | null; created_at: string }>;
}) {
  const [filter, setFilter] = useState<string>("open");

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      all: suggestions.length,
      open:
        (overview.suggestions.new ?? 0) +
        (overview.suggestions.reviewing ?? 0) +
        (overview.suggestions.planned ?? 0),
    };
    for (const status of STATUSES) base[status] = overview.suggestions[status] ?? 0;
    return base;
  }, [overview.suggestions, suggestions.length]);

  const visible = suggestions.filter((item) =>
    filter === "all"
      ? true
      : filter === "open"
        ? ["new", "reviewing", "planned"].includes(item.status)
        : item.status === filter,
  );

  return (
    <div className="space-y-12">
      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Overview
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="accounts" value={overview.users} />
          <Stat label="files" value={overview.files} />
          <Stat label="folders" value={overview.folders} />
          <Stat label="versions" value={overview.versions} />
          <Stat label="storage" value={bytes(overview.storage_bytes)} />
          <Stat label="open suggestions" value={overview.open_suggestions} />
          <Stat label="errors / 24h" value={overview.errors_24h} />
          <Stat label="admins" value={overview.admins} />
        </div>
      </section>

      <section id="suggestions" className="scroll-mt-8">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Suggestions
          </h2>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
            {counts.open} open
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {["open", "all", ...STATUSES].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`h-7 border px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                filter === value
                  ? "border-accent bg-accent text-white"
                  : "border-rule text-ink-faint hover:border-rule-strong hover:text-ink"
              }`}
            >
              {value === "open" ? "open" : (STATUS_LABEL[value] ?? value)}
              {counts[value] !== undefined ? ` ${counts[value]}` : ""}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-dim">Nothing in this bucket.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((item) => (
              <SuggestionCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section id="users" className="scroll-mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Accounts
        </h2>
        <div className="mt-3 overflow-x-auto border border-rule">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-rule bg-panel/40 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                <th className="px-3 py-2 font-normal">account</th>
                <th className="px-3 py-2 font-normal">files</th>
                <th className="px-3 py-2 font-normal">storage</th>
                <th className="px-3 py-2 font-normal">joined</th>
                <th className="px-3 py-2 font-normal">last file edit</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-rule last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="text-[12px] text-ink">
                      {user.display_name ?? user.username}
                    </span>
                    {user.is_admin ? (
                      <span className="ml-2 border border-accent/50 px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--color-accent-text)]">
                        admin
                      </span>
                    ) : null}
                    <p className="font-mono text-[10px] text-ink-faint">
                      {user.username}
                      {user.email ? ` · ${user.email}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-dim">{user.files}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-dim">
                    {bytes(Number(user.storage_bytes))}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-dim">
                    {when(user.created_at)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-ink-dim">
                    {when(user.last_activity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="errors" className="scroll-mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Recent errors
        </h2>
        {errors.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-dim">No errors recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {errors.map((item) => (
              <li key={item.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="border border-rule px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
                    {item.source}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-dim">
                    {item.message}
                  </span>
                  <span className="font-mono text-[9px] text-ink-faint">
                    {when(item.created_at)}
                  </span>
                </div>
                {item.path ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">{item.path}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

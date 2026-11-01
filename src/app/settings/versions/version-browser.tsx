"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWorkspace, type FileRow, type FolderRow, type TreeNode } from "@/lib/tree";
import {
  applyVersionToFile,
  getFileSnapshot,
  listSnapshots,
  listVersions,
  restoreProjectSnapshot,
  restoreVersion,
  type SnapshotSummary,
  type VersionSummary,
} from "../../app/actions";

type Rows = Array<{ id: string; name: string; type: "folder" | "file"; depth: number }>;

type Target = { kind: "folder" | "file"; id: string; name: string };

function flatten(workspace: ReturnType<typeof buildWorkspace>): Rows {
  const out: Rows = [];

  function walk(nodes: TreeNode[], depth: number) {
    for (const node of nodes) {
      out.push({ id: node.id, name: node.name, type: node.type, depth });
      if (node.type === "folder") walk(node.children, depth + 1);
    }
  }

  walk(workspace.projects, 0);
  for (const file of workspace.looseFiles) {
    out.push({ id: file.id, name: file.name, type: "file", depth: 0 });
  }

  return out;
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionBrowser({ folders, files }: { folders: FolderRow[]; files: FileRow[] }) {
  const workspace = useMemo(() => buildWorkspace(folders, files), [folders, files]);
  const rows = useMemo(() => flatten(workspace), [workspace]);

  const [menu, setMenu] = useState<{ x: number; y: number; target: Target } | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (!menu) return;
    function close(event: PointerEvent) {
      if ((event.target as HTMLElement).closest("[data-version-menu]")) return;
      setMenu(null);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border border-rule">
        <p className="border-b border-rule px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          files and projects
        </p>
        <div className="max-h-[60vh] overflow-auto py-1">
          {rows.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-ink-faint">Nothing yet.</p>
          ) : (
            rows.map((row) => (
              <button
                key={`${row.type}:${row.id}`}
                type="button"
                onClick={() => setTarget({ kind: row.type, id: row.id, name: row.name })}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    target: { kind: row.type, id: row.id, name: row.name },
                  });
                }}
                className={[
                  "flex w-full items-center gap-2 px-3 py-1 text-left text-[12px] hover:bg-[#111614]",
                  target?.id === row.id ? "bg-panel text-ink" : "text-ink-dim",
                ].join(" ")}
                style={{ paddingLeft: 12 + row.depth * 14 }}
              >
                <span className="w-3 shrink-0 text-center font-mono text-[9px] text-ink-faint">
                  {row.type === "folder" ? "▸" : ""}
                </span>
                <span className="truncate">{row.name}</span>
              </button>
            ))
          )}
        </div>
        <p className="border-t border-rule px-3 py-2 text-[10px] leading-relaxed text-ink-faint">
          Right-click a row to open its saved versions.
        </p>
      </div>

      <div>
        {!target ? (
          <div className="border border-rule px-4 py-8 text-[12px] leading-relaxed text-ink-faint">
            <p className="text-ink-dim">Pick something on the left.</p>
            <p className="mt-1">
              A file opens a two-pane comparison: current versus a saved version, or two saved
              versions. A project lists its named snapshots.
            </p>
          </div>
        ) : target.kind === "file" ? (
          <FileVersions key={target.id} fileId={target.id} name={target.name} />
        ) : (
          <ProjectVersions key={target.id} projectId={target.id} name={target.name} />
        )}
      </div>

      {menu ? (
        <div
          data-version-menu
          className="fixed z-50 w-[170px] border border-rule-strong bg-panel py-1"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            onClick={() => {
              setTarget(menu.target);
              setMenu(null);
            }}
            className="block w-full px-3 py-1.5 text-left text-[12px] text-ink-dim hover:bg-[#161b18] hover:text-ink"
          >
            View saved versions
          </button>
        </div>
      ) : null}
    </div>
  );
}

const pane =
  "h-[46vh] w-full overflow-auto border border-rule bg-ground px-3 py-2 font-mono text-[11px] leading-[1.6] text-ink-dim";
const picker =
  "h-8 w-full border border-rule bg-ground px-2 font-mono text-[11px] text-ink outline-none focus:border-accent";
const small =
  "h-7 border border-rule px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim hover:border-rule-strong hover:text-ink disabled:opacity-40";

function FileVersions({ fileId, name }: { fileId: string; name: string }) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [current, setCurrent] = useState<{ content: string; revision: number } | null>(null);
  const [left, setLeft] = useState("current");
  const [right, setRight] = useState("current");
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [list, snapshot] = await Promise.all([listVersions(fileId), getFileSnapshot(fileId)]);
    if (list.ok) setVersions(list.versions);
    if (!list.ok) setError(list.error);
    if (snapshot.ok) setCurrent({ content: snapshot.content, revision: snapshot.revision });
    if (!snapshot.ok) setError(snapshot.error);
    setRight((value) => (value === "current" && list.ok && list.versions[0] ? list.versions[0].id : value));
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [list, snapshot] = await Promise.all([
        listVersions(fileId),
        getFileSnapshot(fileId),
      ]);
      if (!alive) return;

      if (list.ok) setVersions(list.versions);
      else setError(list.error);

      if (snapshot.ok) setCurrent({ content: snapshot.content, revision: snapshot.revision });
      else setError(snapshot.error);

      setRight((value) =>
        value === "current" && list.ok && list.versions[0] ? list.versions[0].id : value,
      );
    })();
    return () => {
      alive = false;
    };
  }, [fileId]);

  async function textFor(source: string): Promise<string> {
    if (source === "current") return current?.content ?? "";
    const result = await restoreVersion(source);
    return result.ok ? result.content : "";
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const text = await textFor(left);
      if (!cancelled) setLeftText(text);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, current]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const text = await textFor(right);
      if (!cancelled) setRightText(text);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [right, current]);

  async function apply(source: string) {
    if (source === "current") return;
    setBusy(true);
    setError(null);
    const result = await applyVersionToFile(fileId, source);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await load();
    router.refresh();
  }

  const options = (
    <>
      <option value="current">Current</option>
      {versions.map((version) => (
        <option key={version.id} value={version.id}>
          {(version.label || "unnamed") + " · " + when(version.created_at)}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">{name}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {versions.length} saved
        </span>
      </div>

      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <select value={left} onChange={(event) => setLeft(event.target.value)} className={picker}>
            {options}
          </select>
          <pre className={pane}>{leftText}</pre>
          <button
            type="button"
            onClick={() => void apply(left)}
            disabled={busy || left === "current"}
            className={small}
          >
            Apply left
          </button>
        </div>

        <div className="space-y-1">
          <select value={right} onChange={(event) => setRight(event.target.value)} className={picker}>
            {options}
          </select>
          <pre className={pane}>{rightText}</pre>
          <button
            type="button"
            onClick={() => void apply(right)}
            disabled={busy || right === "current"}
            className={small}
          >
            Apply right
          </button>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-ink-faint">
        Applying writes the chosen content as a new revision, so the old one stays in history.
      </p>
    </div>
  );
}

function ProjectVersions({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const result = await listSnapshots(projectId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSnapshots(result.snapshots);
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await listSnapshots(projectId);
      if (!alive) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSnapshots(result.snapshots);
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function apply(id: string) {
    setBusy(id);
    setError(null);
    const result = await restoreProjectSnapshot(id);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">{name}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {snapshots?.length ?? 0} snapshots
        </span>
      </div>

      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

      {snapshots === null ? (
        <p className="text-[12px] text-ink-faint">Loading…</p>
      ) : snapshots.length === 0 ? (
        <p className="border border-rule px-4 py-6 text-[12px] leading-relaxed text-ink-faint">
          No project snapshots yet. <span className="text-ink-dim">Save Project</span> in the
          editor records one.
        </p>
      ) : (
        <ul className="border border-rule">
          {snapshots.map((snapshot) => (
            <li
              key={snapshot.id}
              className="flex flex-wrap items-center gap-3 border-b border-rule px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-ink">
                  {snapshot.message || <span className="text-ink-faint">unnamed</span>}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-faint">
                  {when(snapshot.created_at)} · {snapshot.file_count} files ·{" "}
                  {snapshot.total_bytes} B
                </p>
              </div>
              <button
                type="button"
                onClick={() => void apply(snapshot.id)}
                disabled={busy !== null}
                className={small}
              >
                {busy === snapshot.id ? "Applying" : "Apply"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

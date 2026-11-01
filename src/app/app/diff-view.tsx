"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MAX_DIFF_ROWS, buildDiffRows, type DiffRow } from "@/lib/diff";

const tint: Record<DiffRow["kind"], string> = {
  same: "",
  add: "bg-[#12261a]",
  del: "bg-[#2a1414]",
  change: "bg-[#241d12]",
};

export function FileDiff({
  left,
  right,
}: {
  left: { id: string; name: string; content: string };
  right: { id: string; name: string; content: string };
}) {
  const router = useRouter();
  const { rows, truncated } = useMemo(
    () => buildDiffRows(left.content, right.content),
    [left.content, right.content],
  );

  const added = rows.filter((row) => row.kind === "add").length;
  const removed = rows.filter((row) => row.kind === "del").length;
  const changed = rows.filter((row) => row.kind === "change").length;

  function close() {
    const params = new URLSearchParams(window.location.search);
    params.delete("diff");
    router.replace(`/app?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-rule px-4 font-mono text-[10px] uppercase tracking-[0.1em]">
        <span className="text-ink-faint">diff</span>
        <span className="truncate text-ink-dim">{left.name}</span>
        <span className="text-ink-faint">↔</span>
        <span className="truncate text-ink-dim">{right.name}</span>
        <span className="ml-2 hidden text-ink-faint sm:inline">
          +{added} −{removed}
          {changed > 0 ? ` ~${changed}` : ""}
        </span>
        <button
          type="button"
          onClick={close}
          className="ml-auto border border-rule px-2 py-1 text-ink-faint hover:border-rule-strong hover:text-ink"
        >
          close diff
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-ground/40 font-mono text-[11px] leading-[1.6]">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="w-10 select-none border-r border-rule px-2 text-right text-[10px] text-ink-faint">
                  {row.leftNo ?? ""}
                </td>
                <td
                  className={`whitespace-pre px-3 text-ink-dim ${row.kind === "del" || row.kind === "change" ? tint[row.kind] : ""}`}
                >
                  {row.left ?? ""}
                </td>
                <td className="w-10 select-none border-l border-r border-rule px-2 text-right text-[10px] text-ink-faint">
                  {row.rightNo ?? ""}
                </td>
                <td
                  className={`whitespace-pre px-3 text-ink-dim ${row.kind === "add" || row.kind === "change" ? tint[row.kind] : ""}`}
                >
                  {row.right ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {truncated ? (
          <p className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            diff truncated at {MAX_DIFF_ROWS} rows
          </p>
        ) : null}
      </div>
    </div>
  );
}

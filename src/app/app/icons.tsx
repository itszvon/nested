/**
 * Type marks. Drawn rather than icon-fonted so they inherit colour and stay
 * crisp at 12px next to 13px text.
 */

export type IconKind = "folder" | "text" | "code";

export function TypeIcon({ kind, className }: { kind: IconKind; className?: string }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.1,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    "aria-hidden": true,
    className: `shrink-0 ${className ?? ""}`,
  };

  if (kind === "folder") {
    return (
      <svg {...common}>
        <path d="M1 3h3.2l1 1.2H11v6.3H1z" />
      </svg>
    );
  }

  if (kind === "code") {
    return (
      <svg {...common}>
        <path d="M2 1.5h8v9H2z" />
        <path d="M4.6 5 3.6 6l1 1M7.4 5l1 1-1 1" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M2 1.5h8v9H2z" />
      <path d="M3.8 4h4.4M3.8 6h4.4M3.8 8h2.6" />
    </svg>
  );
}

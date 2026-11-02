/**
 * One source of truth for what each language does inside Nested.
 *
 * The picker, the file header and the runner all read this, so a language
 * cannot claim to run in one place and refuse in another.
 */

export type LanguageStatus = "runs" | "remote" | "preview" | "checks" | "external";

export type LanguageInfo = {
  label: string;
  status: LanguageStatus;
  /** What to use instead, for languages that need their own tool. */
  tool?: string;
};

export const LANGUAGE_INFO: Record<string, LanguageInfo> = {
  python: { label: "Python", status: "runs" },
  javascript: { label: "JavaScript", status: "runs" },
  html: { label: "HTML", status: "preview" },
  css: { label: "CSS", status: "preview" },
  typescript: { label: "TypeScript", status: "runs" },
  java: { label: "Java", status: "remote" },
  cpp: { label: "C++", status: "remote" },
  go: { label: "Go", status: "remote" },
  rust: { label: "Rust", status: "remote" },
  sql: { label: "SQL", status: "runs" },
  bash: { label: "Bash", status: "remote" },
  json: { label: "JSON", status: "checks" },
  yaml: { label: "YAML", status: "checks" },
};

export const STATUS_LABEL: Record<LanguageStatus, string> = {
  runs: "runs here",
  remote: "runs remotely",
  preview: "preview only",
  checks: "checked here",
  external: "external tool",
};

export function languageLabel(language: string | null): string {
  if (!language) return "text";
  return LANGUAGE_INFO[language]?.label ?? language;
}

export function languageStatus(language: string | null): LanguageStatus {
  if (!language) return "external";
  return LANGUAGE_INFO[language]?.status ?? "external";
}

export function runsHere(language: string | null): boolean {
  return languageStatus(language) === "runs";
}

/** Runs in the browser or in the remote sandbox. */
export function canRun(language: string | null): boolean {
  const status = languageStatus(language);
  return status === "runs" || status === "remote";
}

export function runsRemotely(language: string | null): boolean {
  return languageStatus(language) === "remote";
}

export function previewsHere(language: string | null): boolean {
  return languageStatus(language) === "preview";
}

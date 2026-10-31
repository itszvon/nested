/**
 * One source of truth for what each language does inside Nested.
 *
 * The picker, the file header and the runner all read this, so a language
 * cannot claim to run in one place and refuse in another.
 */

export type LanguageStatus = "runs" | "preview" | "checks" | "external";

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
  java: { label: "Java", status: "external", tool: "a JDK" },
  cpp: { label: "C++", status: "external", tool: "a C++ compiler" },
  go: { label: "Go", status: "external", tool: "the go command" },
  rust: { label: "Rust", status: "external", tool: "cargo" },
  sql: { label: "SQL", status: "runs" },
  bash: { label: "Bash", status: "external", tool: "a shell" },
  json: { label: "JSON", status: "checks" },
  yaml: { label: "YAML", status: "checks" },
};

export const STATUS_LABEL: Record<LanguageStatus, string> = {
  runs: "runs here",
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

export function previewsHere(language: string | null): boolean {
  return languageStatus(language) === "preview";
}

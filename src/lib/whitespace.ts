/**
 * Blank-line tidying, per language.
 *
 * The gentle pass keeps the single blank line people use to separate
 * functions, classes, and sections, and only removes the noise: runs of blank
 * lines, blanks directly after a block opens, and blanks directly before a
 * block closes. Brace languages and Python differ in what "opens" means, HTML
 * has no block delimiters at all, so it only gets the collapse.
 */

const BRACE_LANGUAGES = new Set([
  "javascript",
  "typescript",
  "java",
  "cpp",
  "css",
  "go",
  "rust",
]);

function indentWidth(line: string) {
  const match = line.match(/^[ \t]*/);
  return match ? match[0].length : 0;
}

function opensBlock(previous: string, language: string | null) {
  const trimmed = previous.trimEnd();
  if (language === "python") return trimmed.endsWith(":");
  if (language && BRACE_LANGUAGES.has(language)) return trimmed.endsWith("{");
  return false;
}

function closesBlock(next: string, language: string | null) {
  if (language && BRACE_LANGUAGES.has(language)) return next.trimStart().startsWith("}");
  return false;
}

export function tidyBlankLines(text: string, language: string | null): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() !== "") {
      out.push(line);
      continue;
    }

    // Measure the whole run of blank lines at once.
    let end = i;
    while (end < lines.length && lines[end].trim() === "") end++;

    const previous = out.length > 0 ? out[out.length - 1] : null;
    const next = end < lines.length ? lines[end] : null;

    // Leading and trailing blanks go entirely.
    if (previous === null || next === null) {
      i = end - 1;
      continue;
    }

    // A blank line that only exists because a block was opened or closed.
    if (opensBlock(previous, language) || closesBlock(next, language)) {
      i = end - 1;
      continue;
    }

    // Everything else collapses to exactly one.
    out.push("");
    i = end - 1;
  }

  return out.join("\n");
}

export function removeBlankLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
}

export { indentWidth };

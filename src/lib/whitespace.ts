/**
 * Blank-line tidying, per language.
 *
 * Two jobs, in one pass:
 *
 * 1. Remove noise: runs of blank lines, blanks right after a block opens, and
 *    blanks right before a block closes.
 * 2. Put back the blank lines that carry meaning: between Python definitions and
 *    between brace-language blocks. Without this, "tidy" did nothing after
 *    "flat" had already removed every blank line.
 *
 * Only structure is inferred. Nothing here can reformat code or guess intent
 * beyond block boundaries.
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

const PY_SECTION = /^(?:async\s+)?(?:def|class)\s/;
const CHAIN = /^(?:else|catch|finally|while)\b/;

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

/**
 * Should a blank line go between these two non-blank neighbours? Only at real
 * section boundaries, never inside a block or a continuation.
 */
function wantsBlankBetween(previous: string, current: string, language: string | null): boolean {
  const prev = previous.trim();
  const cur = current.trim();
  if (!prev || !cur) return false;

  if (language === "python") {
    // Decorator chains stay glued to their def.
    if (prev.startsWith("@")) return false;
    // A comment above a definition belongs to it.
    if (prev.startsWith("#")) return false;

    const prevIndent = indentWidth(previous);
    const curIndent = indentWidth(current);

    if (PY_SECTION.test(cur) || cur.startsWith("@")) {
      // Leaving a body back to column zero always earns a blank line.
      if (prevIndent > curIndent) return true;
      // A nested definition follows code at the same indent.
      if (prevIndent === curIndent) return true;
      return false;
    }

    return false;
  }

  if (language && BRACE_LANGUAGES.has(language)) {
    // "};" and "}));" still end a block.
    const prevBlock = prev.replace(/;\s*$/, "").replace(/\)+$/, "");
    if (!prevBlock.endsWith("}")) return false;
    if (cur.startsWith("}")) return false;
    if (CHAIN.test(cur)) return false;
    // Continuations, closers and chain calls are still the same statement.
    // CSS is the exception: a selector legitimately starts with a dot.
    if (/^[)\].,;]/.test(cur) && !(language === "css" && cur.startsWith("."))) return false;
    return true;
  }

  return false;
}

export function tidyBlankLines(text: string, language: string | null): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() !== "") {
      const previous = out.length > 0 ? out[out.length - 1] : null;

      if (
        previous !== null &&
        previous.trim() !== "" &&
        wantsBlankBetween(previous, line, language)
      ) {
        out.push("");
      }

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

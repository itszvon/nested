/**
 * File import/export rules, free of Electron so they can be tested directly.
 *
 * The 2 MB ceiling mirrors the database's `file_too_large` limit: importing
 * something the server would reject only wastes the round trip.
 */

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ImportedFile = { name: string; content: string };
export type ImportResult = { ok: true; file: ImportedFile } | { ok: false; error: string };

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "untitled";
}

function looksBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 512);
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

export function validateImport(path: string, bytes: Uint8Array): ImportResult {
  const name = basename(path);
  if (bytes.byteLength === 0) return { ok: false, error: "That file is empty." };
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: "That file is over the 2 MB limit for a single file." };
  }
  if (looksBinary(bytes)) {
    return { ok: false, error: "That looks like a binary file. Nested stores plain text and code." };
  }
  return { ok: true, file: { name, content: new TextDecoder("utf-8").decode(bytes) } };
}

export function validateExport(name: string, content: unknown): { ok: true; name: string; content: string } | { ok: false; error: string } {
  if (typeof content !== "string") return { ok: false, error: "Nothing to save." };
  if (content.length === 0) return { ok: false, error: "Nothing to save." };
  if (new TextEncoder().encode(content).byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: "That file is over the 2 MB limit for a single file." };
  }
  const clean = basename(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return { ok: true, name: clean || "untitled.txt", content };
}

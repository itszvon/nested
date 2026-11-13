/**
 * `nested://` deep links, parsed without touching Electron so they can be
 * tested directly. Only one shape is supported today: a file id.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeepLink = { kind: "file"; id: string };

export function parseDeepLink(raw: string): DeepLink | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "nested:") return null;
  if (url.hostname !== "file") return null;

  const id = url.pathname.replace(/^\/+/, "").trim();
  if (!UUID.test(id)) return null;

  return { kind: "file", id: id.toLowerCase() };
}

/** First `nested://` argument in a process command line, for Windows. */
export function findDeepLink(args: readonly string[]): string | null {
  for (const arg of args) {
    if (arg.startsWith("nested://")) return arg;
  }
  return null;
}

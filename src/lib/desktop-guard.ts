/**
 * Loopback trust check for the desktop build.
 *
 * A local HTTP server is reachable by every process on the machine. The app is
 * loaded from 127.0.0.1, so the browser cannot tell a legitimate request from
 * one made by malware running as the same user. Two cheap checks close that:
 *
 * - `Host` must be the loopback origin. A hostile page on the internet cannot
 *   set it through DNS rebinding because the browser sends the resolved host.
 * - A per-launch token, injected by the Electron main process, must match.
 *
 * Both are no-ops on the web deployment, where NESTED_DESKTOP_TOKEN is unset.
 */

export type DesktopGuardConfig = {
  token?: string;
  /** e.g. "127.0.0.1:43110" */
  host?: string;
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function desktopGuard(headers: Headers, config: DesktopGuardConfig): "ok" | "forbidden" {
  if (!config.token) return "ok";

  if (config.host && headers.get("host") !== config.host) return "forbidden";

  const provided = headers.get("x-nested-desktop") ?? "";
  return constantTimeEqual(provided, config.token) ? "ok" : "forbidden";
}

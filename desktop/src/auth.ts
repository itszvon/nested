import { shell } from "electron";
import { isOAuthNavigation } from "./oauth-urls";

/**
 * Sign-in leaves the app: the system browser owns the Google session and the
 * loopback callback comes back to the local server, which sets the cookie the
 * window already reads.
 */
export function openExternalAuth(url: string): void {
  void shell.openExternal(url);
}

export { isOAuthNavigation };

import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The Next standalone server, managed as a child process of Electron's Node.
 *
 * No Supabase logic lives here. This module only starts, watches and stops the
 * same server the web deployment runs, with the origin pointed at loopback.
 */

const MAX_LOG_BYTES = 1024 * 1024;

export type StartOptions = {
  entry: string;
  port: number;
  token: string;
  /** Host header the server should accept, e.g. "127.0.0.1:43110". */
  host?: string;
  /** Absent in tests, where stdout is not worth keeping. */
  logDir?: string;
};

function openLog(logDir: string | undefined) {
  if (!logDir) return null;

  mkdirSync(logDir, { recursive: true });
  const file = join(logDir, "server.log");
  if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
    renameSync(file, join(logDir, "server.1.log"));
  }
  return createWriteStream(file, { flags: "a" });
}

export function startServer({ entry, port, token, host, logDir }: StartOptions): ChildProcess {
  const log = openLog(logDir);

  const child = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      // Electron's binary behaves as plain Node with this set, so the package
      // does not need to ship a second Node runtime.
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
      NESTED_DESKTOP_HOST: host ?? `127.0.0.1:${port}`,
      NESTED_DESKTOP_TOKEN: token,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (log) {
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    child.on("exit", () => log.end());
  } else {
    child.stdout?.resume();
    child.stderr?.resume();
  }

  return child;
}

/**
 * True once the server answers at all. A 503 from `/api/health` still proves
 * the process is listening, which is what the window needs before loading.
 */
export async function waitForServer(
  origin: string,
  timeoutMs: number,
  token?: string,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(`${origin}/api/health`, {
        signal: controller.signal,
        cache: "no-store",
        headers: token ? { "x-nested-desktop": token } : undefined,
      });
      clearTimeout(timer);
      // A 403 with our own token means another process owns this port, not our
      // server. Attaching to it would break every page, so treat it as down.
      if (response.status === 403) return false;
      if (response.status < 500 || response.status === 503) return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

export async function stopServer(child: ChildProcess, timeoutMs = 5000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill();
  });
}

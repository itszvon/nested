/**
 * Remote execution for languages a browser cannot run.
 *
 * Java, C++, Go, Rust and Bash need a compiler and a real operating system.
 * They run in a sandboxed remote judge (Judge0 by default), never in the page.
 * The request is made from the server so the provider key stays private and
 * the app's CSP does not need to allow the provider.
 *
 * Point NESTED_RUNNER_URL at a self-hosted Judge0 instance to keep code on
 * infrastructure you control. NESTED_RUNNER_KEY is sent as X-Auth-Token.
 */

export type RemoteResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  compileOutput: string;
  status: string;
  time: string | null;
  memory: number | null;
  error?: string;
};

/** Language id on Judge0 CE. Keep in sync with docs/adding-a-language.md. */
const JUDGE0_LANGUAGE: Record<string, { id: number; label: string }> = {
  java: { id: 91, label: "Java (JDK 17)" },
  cpp: { id: 105, label: "C++ (GCC 14)" },
  go: { id: 107, label: "Go 1.23" },
  rust: { id: 108, label: "Rust 1.85" },
  bash: { id: 46, label: "Bash 5.0" },
};

export const REMOTE_LANGUAGES = new Set(Object.keys(JUDGE0_LANGUAGE));

export function isRemoteLanguage(language: string | null): boolean {
  return language !== null && REMOTE_LANGUAGES.has(language);
}

function baseUrl(): string {
  return (process.env.NESTED_RUNNER_URL ?? "https://ce.judge0.com").replace(/\/+$/, "");
}

type Judge0Response = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status?: { id?: number; description?: string };
};

export async function runRemotely(input: {
  language: string;
  code: string;
  stdin?: string;
}): Promise<RemoteResult> {
  const target = JUDGE0_LANGUAGE[input.language];
  if (!target) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      compileOutput: "",
      status: "unsupported",
      time: null,
      memory: null,
      error: `${input.language} has no remote runtime configured.`,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.NESTED_RUNNER_KEY) {
    headers["X-Auth-Token"] = process.env.NESTED_RUNNER_KEY;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(
      `${baseUrl()}/submissions?base64_encoded=false&wait=true&fields=*`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          source_code: input.code,
          language_id: target.id,
          stdin: input.stdin ?? "",
          // Enough for a class or two, short enough that a runaway loop is
          // cut off before it costs anything.
          cpu_time_limit: 5,
          cpu_extra_time: 1,
          wall_time_limit: 12,
          memory_limit: 256000,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        stdout: "",
        stderr: "",
        compileOutput: "",
        status: "unavailable",
        time: null,
        memory: null,
        error:
          response.status === 429
            ? "The execution sandbox is busy. Wait a moment and run again."
            : `The execution sandbox refused the request (${response.status}). ${detail.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as Judge0Response;
    const status = data.status?.description ?? "unknown";

    return {
      ok: !data.stderr && !data.compile_output && !data.message && status !== "Time Limit Exceeded",
      stdout: data.stdout ?? "",
      stderr: data.stderr ?? "",
      compileOutput: data.compile_output ?? "",
      status,
      time: data.time ?? null,
      memory: typeof data.memory === "number" ? data.memory : null,
      error: data.message ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      compileOutput: "",
      status: "unavailable",
      time: null,
      memory: null,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "The execution sandbox did not answer in time."
          : "The execution sandbox could not be reached.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function remoteRuntimeLabel(language: string): string {
  return JUDGE0_LANGUAGE[language]?.label ?? language;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RUNNER_WORKER_SOURCE } from "@/lib/runner-worker";
import { LANGUAGE_INFO, languageLabel } from "@/lib/languages";

/**
 * Runs a file, locally, inside a sandboxed iframe.
 *
 * The iframe has `allow-scripts` and deliberately NOT `allow-same-origin`, so
 * the document runs in an opaque origin: it cannot read cookies, localStorage,
 * or your session. Network access is replaced with throwing stubs before user
 * code executes. The only channel out is postMessage, checked against a
 * per-run nonce.
 *
 * Java and C++ have no in-browser runtime, so they are refused here rather
 * than shipped to a third-party service.
 */

const ESC = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

function jsDocument(code: string, nonce: string) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>
(function () {
  var nonce = ${JSON.stringify(nonce)};
  function send(type, text) {
    try { parent.postMessage({ nonce: nonce, type: type, text: String(text) }, "*"); } catch (e) {}
  }
  function fmt(value) {
    try { return typeof value === "string" ? value : JSON.stringify(value); }
    catch (e) { return String(value); }
  }
  ["log", "info", "warn", "error", "debug"].forEach(function (kind) {
    console[kind] = function () {
      var args = [].slice.call(arguments).map(fmt).join(" ");
      send("log", (kind === "log" ? "" : kind.toUpperCase() + ": ") + args);
    };
  });
  window.onerror = function (message) { send("error", message); };

  ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "Worker"].forEach(function (name) {
    try {
      window[name] = function () { throw new Error("network and workers are disabled in the runner"); };
    } catch (e) {}
  });

  try {
    var run = new Function(${ESC(code)});
    run();
    send("done");
  } catch (error) {
    send("error", (error && error.message) || String(error));
  }
})();
<\/script></body></html>`;
}

function pythonDocument(code: string, nonce: string) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script src="https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"><\/script>
<script>
(async function () {
  var nonce = ${JSON.stringify(nonce)};
  function send(type, text) {
    try { parent.postMessage({ nonce: nonce, type: type, text: String(text) }, "*"); } catch (e) {}
  }
  try {
    send("status", "loading python runtime (first run downloads about 10 MB)…");
    var pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" });
    pyodide.setStdout({ batched: function (text) { send("log", String(text).replace(/\\n$/, "")); } });
    pyodide.setStderr({ batched: function (text) { send("log", String(text).replace(/\\n$/, "")); } });

    // Pyodide has no stdin, so input() would raise OSError 29. Route it to a
    // browser prompt instead, and print the question first so it is not lost.
    pyodide.globals.set("js_input", function (question) {
      var asked = question ? String(question) : "";
      send("input", asked);
      var answer = window.prompt(asked || "input", "");
      answer = answer === null ? "" : String(answer);
      send("echo", answer);
      return answer;
    });
    await pyodide.runPythonAsync([
      "import builtins",
      "def _nested_input(question=''):",
      "    return str(js_input(question))",
      "builtins.input = _nested_input",
    ].join("\\n"));

    await pyodide.runPythonAsync(${ESC(code)});
    send("done");
  } catch (error) {
    send("error", (error && error.message) || String(error));
  }
})();
<\/script></body></html>`;
}

function cssDocument(code: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${code}</style></head>
<body style="padding:16px">
  <h1>Heading one</h1>
  <h2>Heading two</h2>
  <p>Paragraph text with a <a href="#">link</a> and some <strong>bold</strong>.</p>
  <ul><li>First item</li><li>Second item</li></ul>
  <button>Button</button>
  <input placeholder="Input field">
</body></html>`;
}

type ConsoleLine = { kind: "out" | "ask" | "in" | "err"; text: string };

const SUPPORTED = new Set([
  "javascript",
  "python",
  "typescript",
  "sql",
  "html",
  "css",
  "json",
  "yaml",
]);

export function RunnerPanel({
  language,
  code,
  runId,
  onClose,
}: {
  language: string | null;
  code: string;
  runId: number;
  onClose: () => void;
}) {
  const nonce = useMemo(() => Math.random().toString(36).slice(2), [runId]);
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [status, setStatus] = useState<"running" | "done" | "timeout">("running");
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  // Inline stdin: available only when the page is cross-origin isolated, which
  // is what makes SharedArrayBuffer and Atomics.wait legal.
  const [isolated, setIsolated] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [height, setHeight] = useState(224);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [answer, setAnswer] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const controlRef = useRef<Int32Array | null>(null);
  const bufferRef = useRef<SharedArrayBuffer | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsolated(window.crossOriginIsolated === true);
  }, []);

  // The output panel is resizable from its top edge, remembered per device.
  useEffect(() => {
    const saved = Number(localStorage.getItem("nested.runnerHeight"));
    if (Number.isFinite(saved) && saved >= 120 && saved <= 620) setHeight(saved);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("nested.runnerHeight", String(height));
    } catch {
      /* ignore */
    }
  }, [height]);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setHeight(
        Math.min(620, Math.max(120, drag.startHeight + (drag.startY - event.clientY))),
      );
    }
    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const supported = language !== null && SUPPORTED.has(language);
  const preview = language === "html" || language === "css";
  // TypeScript and SQL load their runtimes in the worker, which needs the
  // shared-memory isolation that Python and JavaScript already require.
  const needsIsolation = language === "typescript" || language === "sql";
  const blocked = needsIsolation && !isolated;
  const usesWorker =
    isolated &&
    (language === "python" ||
      language === "javascript" ||
      language === "typescript" ||
      language === "sql");

  /**
   * Idle timeout, not wall-clock: interactive scripts that keep producing
   * output are never cut off, and a runaway loop still stops.
   */
  const bumpIdle = useCallback(() => {
    if (!supported) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const limit = language === "python" ? 120000 : 15000;
    idleTimer.current = setTimeout(() => {
      setStatus((current) => (current === "running" ? "timeout" : current));
      setLines((current) => [
        ...current,
        { kind: "err", text: `No output for ${limit / 1000}s, stopped.` },
      ]);
    }, limit);
  }, [language, supported]);

  useEffect(() => {
    setLines([]);
    setStatus("running");
    setStopped(false);
  }, [runId]);

  /**
   * JSON and YAML have no runtime: running them means parsing. The parsed
   * result is printed, so the panel behaves like every other language.
   */
  useEffect(() => {
    if (language !== "json" && language !== "yaml") return;

    let cancelled = false;

    void (async () => {
      try {
        const value =
          language === "json"
            ? JSON.parse(code)
            : (await import("js-yaml")).load(code);

        if (cancelled) return;
        setLines([
          { kind: "out", text: language === "json" ? "valid json" : "valid yaml" },
          { kind: "out", text: JSON.stringify(value, null, 2) ?? "null" },
        ]);
      } catch (error) {
        if (cancelled) return;
        setLines([{ kind: "err", text: (error as Error).message }]);
      }

      setStatus("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [language, code, runId]);

  /** Kills the runtime. The only way out of a `while True` without waiting. */
  function stop() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus("done");
    setAwaiting(false);
    setStopped(true);
    setLines((current) => [...current, { kind: "err", text: "Stopped." }]);
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.nonce !== nonce) return;

      if (data.type === "log" || data.type === "status") {
        setLines((current) => [...current, { kind: "out", text: String(data.text) }]);
        bumpIdle();
      } else if (data.type === "input") {
        setLines((current) => [...current, { kind: "ask", text: String(data.text) }]);
        bumpIdle();
      } else if (data.type === "echo") {
        setLines((current) => [...current, { kind: "in", text: String(data.text) }]);
        bumpIdle();
      } else if (data.type === "done") {
        setStatus("done");
      } else if (data.type === "error") {
        setLines((current) => [...current, { kind: "err", text: String(data.text) }]);
        setStatus("done");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [nonce, bumpIdle]);

  useEffect(() => {
    bumpIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [bumpIdle, runId]);

  useEffect(() => {
    const element = consoleRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (awaiting) inputRef.current?.focus();
  }, [awaiting]);

  // Worker runtime for Python. It blocks on Atomics.wait for input instead of
  // opening a browser dialog.
  useEffect(() => {
    if (!usesWorker) return;

    const control = new Int32Array(new SharedArrayBuffer(8));
    const buffer = new SharedArrayBuffer(8192);
    controlRef.current = control;
    bufferRef.current = buffer;

    let cancelled = false;
    const blob = new Blob([RUNNER_WORKER_SOURCE], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data ?? {};

      if (data.type === "out" || data.type === "status") {
        setLines((current) => [...current, { kind: "out", text: String(data.text) }]);
        bumpIdle();
      } else if (data.type === "input") {
        setLines((current) => [...current, { kind: "ask", text: String(data.text) }]);
        setAwaiting(true);
        bumpIdle();
      } else if (data.type === "done") {
        setStatus("done");
        setAwaiting(false);
      } else if (data.type === "error") {
        setLines((current) => [...current, { kind: "err", text: String(data.text) }]);
        setStatus("done");
        setAwaiting(false);
      }
    };

    worker.postMessage({ type: "init", control: control.buffer, buffer });

    void (async () => {
      let payload = code;
      let runtime = language ?? "javascript";

      if (language === "typescript") {
        try {
          const { transform } = await import("sucrase");
          payload = transform(code, {
            transforms: ["typescript"],
            disableESTransforms: true,
          }).code;
          runtime = "javascript";
          setLines((current) => [
            ...current,
            { kind: "out", text: "types erased (syntax only, no type checking)" },
          ]);
        } catch (error) {
          setLines((current) => [
            ...current,
            { kind: "err", text: `TypeScript could not be read: ${(error as Error).message}` },
          ]);
          setStatus("done");
          return;
        }
      }

      if (!cancelled) {
        worker.postMessage({ type: "run", code: payload, language: runtime });
      }
    })();

    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
      URL.revokeObjectURL(url);
      setAwaiting(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, language, usesWorker]);

  function submitAnswer() {
    const control = controlRef.current;
    const buffer = bufferRef.current;
    if (!control || !buffer) return;

    const bytes = new TextEncoder().encode(`${answer}\n`);
    const view = new Uint8Array(buffer, 0, Math.min(bytes.length, buffer.byteLength));
    view.set(bytes.subarray(0, view.length));

    Atomics.store(control, 1, view.length);
    Atomics.store(control, 0, 2);
    Atomics.notify(control, 0);

    setLines((current) => [...current, { kind: "in", text: answer }]);
    setAnswer("");
    setAwaiting(false);
    bumpIdle();
  }

  // Only the iframe runtimes need a document. Everything else prints into the
  // console pane or the worker, so an empty document is rendered instead.
  const document_ = supported
    ? language === "javascript"
      ? jsDocument(code, nonce)
      : language === "python"
        ? pythonDocument(code, nonce)
        : language === "html"
          ? code
          : language === "css"
            ? cssDocument(code)
            : null
    : null;

  return (
    <div
      style={{ height }}
      className="flex shrink-0 flex-col border-t border-rule bg-panel/60"
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize output"
        onPointerDown={(event) => {
          dragRef.current = { startY: event.clientY, startHeight: height };
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
          event.preventDefault();
        }}
        className="h-1 w-full shrink-0 cursor-row-resize hover:bg-accent/40"
      />
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-rule px-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          {preview ? "preview" : "output"}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          {!supported
            ? "unsupported"
            : status === "running"
              ? "running"
              : status === "timeout"
                ? "stopped"
                : "finished"}
        </span>
        {status === "running" ? (
          <button
            type="button"
            onClick={stop}
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent-text)] hover:text-ink"
          >
            stop
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className={`${status === "running" ? "" : "ml-auto "}font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink`}
        >
          close
        </button>
      </div>

      {blocked ? (
        <div className="px-4 py-4 text-[12px] leading-relaxed text-ink-dim">
          <p className="text-ink">{languageLabel(language)} needs cross-origin isolation.</p>
          <p className="mt-1 text-ink-faint">
            This browser reported that the page is not isolated, so the runtime cannot start.
            Reload the page; if it keeps happening, the browser is refusing the headers this app
            sends.
          </p>
        </div>
      ) : !supported ? (
        <div className="px-4 py-4 text-[12px] leading-relaxed text-ink-dim">
          <p className="text-ink">{languageLabel(language)} does not run in Nested.</p>
          <p className="mt-1 text-ink-faint">
            Run it with {LANGUAGE_INFO[language ?? ""]?.tool ?? "its own toolchain"} on your
            machine and paste the result back here.
          </p>
          <p className="mt-1 text-ink-faint">
            JavaScript, TypeScript, Python and SQL execute in the browser. HTML and CSS render a
            preview. Nothing is sent anywhere.
          </p>
        </div>
      ) : preview ? (
        <iframe
          key={`${runId}-${stopped ? "stopped" : "live"}`}
          title="Preview"
          sandbox="allow-scripts allow-modals"
          referrerPolicy="no-referrer"
          srcDoc={document_ ?? ""}
          className="h-full w-full flex-1 bg-white"
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <div
            ref={consoleRef}
            className="min-w-0 flex-1 overflow-auto bg-ground/70 px-3 py-2 font-mono text-[12px] leading-[1.6]"
          >
            {lines.length === 0 ? <p className="text-ink-faint">…</p> : null}
            {lines.map((line, index) => (
              <p
                key={index}
                className={
                  line.kind === "ask"
                    ? "text-ink"
                    : line.kind === "in"
                      ? "text-[var(--color-accent-text)]"
                      : line.kind === "err"
                        ? "text-red-300"
                        : "text-ink-dim"
                }
              >
                {line.kind === "in" ? `> ${line.text}` : line.text}
              </p>
            ))}
            {awaiting ? (
              <div className="flex items-center gap-1">
                <span className="text-[var(--color-accent-text)]">&gt;</span>
                <input
                  ref={inputRef}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitAnswer();
                    }
                  }}
                  aria-label="Program input"
                  className="min-w-0 flex-1 border-0 bg-transparent text-ink caret-accent outline-none"
                />
              </div>
            ) : null}
            {status === "running" && !awaiting ? (
              <p className="text-ink-faint">▌</p>
            ) : null}
          </div>
          {usesWorker || stopped ? null : (
            <iframe
              key={runId}
              title="Runner"
              sandbox="allow-scripts allow-modals"
              referrerPolicy="no-referrer"
              srcDoc={document_ ?? ""}
              className="hidden h-0 w-0"
            />
          )}
        </div>
      )}
    </div>
  );
}

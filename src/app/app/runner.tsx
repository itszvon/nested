"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PYTHON_WORKER_SOURCE } from "@/lib/python-worker";

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

const SUPPORTED = new Set(["javascript", "python", "html", "css"]);

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
  const [answer, setAnswer] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const controlRef = useRef<Int32Array | null>(null);
  const bufferRef = useRef<SharedArrayBuffer | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsolated(window.crossOriginIsolated === true);
  }, []);

  const supported = language !== null && SUPPORTED.has(language);
  const preview = language === "html" || language === "css";

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
  }, [runId]);

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
    if (language !== "python" || !supported || !isolated) return;

    const control = new Int32Array(new SharedArrayBuffer(8));
    const buffer = new SharedArrayBuffer(8192);
    controlRef.current = control;
    bufferRef.current = buffer;

    const blob = new Blob([PYTHON_WORKER_SOURCE], { type: "text/javascript" });
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
    worker.postMessage({ type: "run", code });

    return () => {
      worker.terminate();
      workerRef.current = null;
      URL.revokeObjectURL(url);
      setAwaiting(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, language, supported, isolated]);

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

  const document_ = supported
    ? language === "javascript"
      ? jsDocument(code, nonce)
      : language === "python"
        ? pythonDocument(code, nonce)
        : language === "html"
          ? code
          : cssDocument(code)
    : null;

  return (
    <div className="flex h-56 shrink-0 flex-col border-t border-rule bg-panel/60">
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
        <button
          type="button"
          onClick={onClose}
          className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink"
        >
          close
        </button>
      </div>

      {!supported ? (
        <div className="px-4 py-4 text-[12px] leading-relaxed text-ink-dim">
          <p className="text-ink">
            {language === "java" || language === "cpp"
              ? `${language === "java" ? "Java" : "C++"} cannot run in the browser.`
              : "This file type does not run."}
          </p>
          <p className="mt-1 text-ink-faint">
            There is no browser runtime for {language === "java" ? "a JVM" : "a C++ toolchain"}, and
            running it would mean sending your code to an outside service. That is not something
            this app does.
          </p>
        </div>
      ) : preview ? (
        <iframe
          key={runId}
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
                      ? "text-accent"
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
                <span className="text-accent">&gt;</span>
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
          {language === "python" && isolated ? null : (
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

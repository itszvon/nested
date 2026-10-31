"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState<"running" | "done" | "timeout">("running");

  const supported = language !== null && SUPPORTED.has(language);
  const preview = language === "html" || language === "css";

  useEffect(() => {
    setLines([]);
    setStatus("running");
  }, [runId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.nonce !== nonce) return;

      if (data.type === "log" || data.type === "status") {
        setLines((current) => [...current, String(data.text)]);
      } else if (data.type === "done") {
        setStatus("done");
      } else if (data.type === "error") {
        setLines((current) => [...current, `Error: ${data.text}`]);
        setStatus("done");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [nonce]);

  useEffect(() => {
    if (!supported) return;
    const limit = language === "python" ? 45000 : 10000;
    const timer = setTimeout(() => {
      setStatus((current) => (current === "running" ? "timeout" : current));
      setLines((current) => [...current, `Stopped after ${limit / 1000}s.`]);
    }, limit);
    return () => clearTimeout(timer);
  }, [runId, language, supported]);

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
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={document_ ?? ""}
          className="h-full w-full flex-1 bg-white"
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-dim">
            {lines.length === 0 ? "…" : lines.join("\n")}
          </pre>
          <iframe
            key={runId}
            title="Runner"
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={document_ ?? ""}
            className="hidden h-0 w-0"
          />
        </div>
      )}
    </div>
  );
}

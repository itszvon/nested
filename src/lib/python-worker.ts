/**
 * Worker source for the Python runner.
 *
 * Runs as a string so it can be started from a Blob URL without a build step.
 * The worker has no DOM and, once Pyodide is loaded, no network: everything
 * that could reach out is replaced before user code runs.
 *
 * stdin is the point of the whole file. `input()` must block, and a browser
 * can only block a worker on Atomics.wait over a SharedArrayBuffer, which is
 * why the app is served cross-origin isolated.
 */
export const PYTHON_WORKER_SOURCE = String.raw`
let pyodide = null;
let control = null;
let buffer = null;
let ready = false;

function send(type, text) {
  postMessage({ type: type, text: String(text) });
}

function readLine(question) {
  send("input", question || "");
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);

  // Wait for the main thread to hand over an answer (state 2).
  while (Atomics.load(control, 0) === 1) {
    Atomics.wait(control, 0, 1, 200);
  }

  var length = Atomics.load(control, 1);
  // TextDecoder rejects views backed by shared memory, so copy the bytes out
  // into an ordinary array before decoding.
  var shared = new Uint8Array(buffer, 0, length);
  var copy = new Uint8Array(length);
  copy.set(shared);
  var text = new TextDecoder().decode(copy);
  Atomics.store(control, 0, 0);
  return text.replace(/\n$/, "");
}

function lockDown() {
  var block = function () {
    throw new Error("network and storage are disabled in the runner");
  };
  try { self.fetch = block; } catch (e) {}
  try { self.WebSocket = block; } catch (e) {}
  try { self.EventSource = block; } catch (e) {}
  try { self.importScripts = block; } catch (e) {}
  try { self.indexedDB = undefined; } catch (e) {}
  try { self.caches = undefined; } catch (e) {}
}

self.onmessage = async function (event) {
  var message = event.data;

  if (message.type === "init") {
    control = new Int32Array(message.control);
    buffer = message.buffer;
    return;
  }

  if (message.type !== "run") return;

  try {
    if (!ready) {
      send("status", "loading python runtime (first run downloads about 10 MB)...");
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });
      pyodide.setStdout({ batched: function (text) { send("out", String(text).replace(/\n$/, "")); } });
      pyodide.setStderr({ batched: function (text) { send("out", String(text).replace(/\n$/, "")); } });
      pyodide.globals.set("js_input", function (question) { return readLine(question); });
      await pyodide.runPythonAsync(
        "import builtins\n" +
        "def _nested_input(question=''):\n" +
        "    return str(js_input(question))\n" +
        "builtins.input = _nested_input\n"
      );
      lockDown();
      ready = true;
    }

    await pyodide.runPythonAsync(message.code);
    send("done", "");
  } catch (error) {
    send("error", (error && error.message) || String(error));
  }
};
`;

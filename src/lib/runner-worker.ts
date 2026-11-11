/**
 * Worker source for the code runner, shared by JavaScript and Python.
 *
 * Runs as a string so it can start from a Blob URL without a build step.
 *
 * The point of the file is stdin. `input()` and `prompt()` must block, and a
 * browser can only block a worker on Atomics.wait over a SharedArrayBuffer,
 * which is why the app is served cross-origin isolated. Both languages route
 * their input through the same readLine().
 *
 * After the runtime is ready, everything that could reach the network or
 * storage is replaced with a throwing stub. There is no DOM in a worker.
 */
export const RUNNER_WORKER_SOURCE = String.raw`
let control = null;
let buffer = null;
let pyodide = null;
let pyReady = false;
let sqlite = null;

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
  // TextDecoder rejects views backed by shared memory, so copy the bytes out.
  var shared = new Uint8Array(buffer, 0, length);
  var copy = new Uint8Array(length);
  copy.set(shared);
  var text = new TextDecoder().decode(copy);
  Atomics.store(control, 0, 0);
  return text.replace(/\n$/, "");
}

// Pyodide ships no GUI toolkit and no terminal. Detecting these before the
// runtime download turns a wall of traceback into one sentence.
var UNSUPPORTED_PY = {
  tkinter: "tkinter needs a windowing system, and a browser worker has none.",
  turtle: "turtle draws into a Tk window, which cannot open here.",
  curses: "curses needs a real terminal.",
  idlelib: "idlelib is the IDLE editor itself."
};

function unsupportedImport(code) {
  var re = /^[ \t]*(?:import[ \t]+([A-Za-z_][A-Za-z0-9_]*)|from[ \t]+([A-Za-z_][A-Za-z0-9_]*))/gm;
  var match;
  while ((match = re.exec(code))) {
    var name = match[1] || match[2];
    if (Object.prototype.hasOwnProperty.call(UNSUPPORTED_PY, name)) return name;
  }
  return null;
}

function unsupportedMessage(name) {
  return name + " is not available in the browser runner. " +
    UNSUPPORTED_PY[name] +
    " The file is still saved; run it with Python on your machine instead.";
}

function lockDown() {
  var block = function () {
    throw new Error("network and storage are disabled in the runner");
  };
  try { self.fetch = block; } catch (e) {}
  try { self.XMLHttpRequest = block; } catch (e) {}
  try { self.WebSocket = block; } catch (e) {}
  try { self.EventSource = block; } catch (e) {}
  try { self.importScripts = block; } catch (e) {}
  try { self.Worker = block; } catch (e) {}
  try { self.SharedWorker = block; } catch (e) {}
  try { self.BroadcastChannel = block; } catch (e) {}
  try { self.WebTransport = block; } catch (e) {}
  try { self.RTCPeerConnection = block; } catch (e) {}
  try { self.navigator.sendBeacon = block; } catch (e) {}
  try { self.indexedDB = undefined; } catch (e) {}
  try { self.caches = undefined; } catch (e) {}
}

function installConsole() {
  function fmt(value) {
    try { return typeof value === "string" ? value : JSON.stringify(value); }
    catch (e) { return String(value); }
  }
  try {
    self.console = {
      log: function () { send("out", [].slice.call(arguments).map(fmt).join(" ")); },
      info: function () { send("out", [].slice.call(arguments).map(fmt).join(" ")); },
      debug: function () { send("out", [].slice.call(arguments).map(fmt).join(" ")); },
      warn: function () { send("out", "WARN: " + [].slice.call(arguments).map(fmt).join(" ")); },
      error: function () { send("out", "ERROR: " + [].slice.call(arguments).map(fmt).join(" ")); }
    };
    // prompt() is the JavaScript equivalent of input(). Same blocking path.
    self.prompt = function (question) {
      return readLine(question === undefined || question === null ? "" : String(question));
    };
    self.alert = function (message) { send("out", String(message)); };
  } catch (e) {
    send("error", "could not install the console stubs: " + e.message);
  }
}

async function runPython(code) {
  var blocked = unsupportedImport(code);
  if (blocked) {
    send("error", unsupportedMessage(blocked));
    send("done", "");
    return;
  }

  if (!pyReady) {
    send("status", "loading python runtime (first run downloads about 10 MB)...");
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
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
    pyReady = true;
  }

  await pyodide.runPythonAsync(code);
  send("done", "");
}

async function runSql(code) {
  if (!sqlite) {
    send("status", "loading sqlite (about 1 MB)...");
    importScripts("https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js");
    sqlite = await initSqlJs({
      locateFile: function (name) {
        return "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/" + name;
      }
    });
    lockDown();
  }

  var db = new sqlite.Database();
  try {
    var results = db.exec(code);
    if (!results || results.length === 0) {
      send("out", "no rows returned");
    } else {
      results.forEach(function (result) {
        send("out", result.columns.join(" | "));
        result.values.forEach(function (row) {
          send("out", row.map(function (value) {
            return value === null ? "NULL" : String(value);
          }).join(" | "));
        });
      });
    }
    send("done", "");
  } catch (error) {
    send("error", (error && error.message) || String(error));
  } finally {
    db.close();
  }
}

function runJavaScript(code) {
  installConsole();
  lockDown();
  try {
    (0, eval)(code);
    send("done", "");
  } catch (error) {
    send("error", (error && error.message) || String(error));
  }
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
    if (message.language === "python") {
      await runPython(message.code);
    } else if (message.language === "sql") {
      await runSql(message.code);
    } else {
      runJavaScript(message.code);
    }
  } catch (error) {
    var text = (error && error.message) || String(error);
    var missing = /ModuleNotFoundError: No module named '([^']+)'/.exec(text);
    if (missing && Object.prototype.hasOwnProperty.call(UNSUPPORTED_PY, missing[1])) {
      text = unsupportedMessage(missing[1]);
    }
    send("error", text);
  }
};
`;

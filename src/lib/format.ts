/**
 * Formatting, in a throwaway worker.
 *
 * Prettier standalone plus its plugins, pulled from a CDN on first use. The
 * worker exists so a slow format cannot stall typing, and it is terminated
 * after every call.
 */

const BASE = "https://cdn.jsdelivr.net/npm/prettier@3.3.3";

const WORKER_SOURCE = String.raw`
let loaded = false;

function load() {
  if (loaded) return;
  importScripts("${BASE}/standalone.js");
  importScripts("${BASE}/plugins/babel.js");
  importScripts("${BASE}/plugins/estree.js");
  importScripts("${BASE}/plugins/typescript.js");
  importScripts("${BASE}/plugins/html.js");
  importScripts("${BASE}/plugins/postcss.js");
  loaded = true;
}

const PARSER = {
  javascript: "babel",
  typescript: "typescript",
  html: "html",
  css: "css"
};

self.onmessage = async function (event) {
  var message = event.data;
  try {
    load();
    var parser = PARSER[message.language];
    if (!parser) throw new Error("no formatter for " + message.language);
    var formatted = await prettier.format(message.code, {
      parser: parser,
      plugins: prettier.plugins
    });
    postMessage({ type: "done", code: formatted });
  } catch (error) {
    postMessage({ type: "error", message: (error && error.message) || String(error) });
  }
};
`;

/** Languages this build can format. Others hide the button rather than fail. */
export const FORMATTABLE = new Set(["javascript", "typescript", "html", "css"]);

export function formatCode(language: string, code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!FORMATTABLE.has(language)) {
      reject(new Error("No formatter for this language."));
      return;
    }

    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);

    const finish = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };

    const timer = setTimeout(() => {
      finish();
      reject(new Error("The formatter timed out."));
    }, 20000);

    worker.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      finish();
      if (event.data?.type === "done") resolve(String(event.data.code));
      else reject(new Error(String(event.data?.message ?? "Formatting failed.")));
    };

    worker.onerror = () => {
      clearTimeout(timer);
      finish();
      reject(new Error("The formatter could not start."));
    };

    worker.postMessage({ language, code });
  });
}

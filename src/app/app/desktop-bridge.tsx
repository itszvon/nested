"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFile, saveFile } from "./actions";

/**
 * Desktop-only bridge.
 *
 * In a browser none of this exists: `window.nested` is undefined and the
 * component renders nothing. In the Electron shell it does two things the web
 * cannot:
 *
 * - forwards the editor's existing `nested:dirty` event to the main process, so
 *   an update never restarts over unsaved work;
 * - receives a file picked in the native dialog and creates it at the project
 *   root, keeping its name.
 */

type OpenedFile = { name: string; content: string };

type DesktopApi = {
  setDirty?: (value: boolean) => Promise<unknown>;
  onFileOpened?: (callback: (file: OpenedFile) => void) => () => void;
};

const CODE_LANGUAGES: Record<string, string> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  html: "html",
  css: "css",
  sql: "sql",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  go: "go",
  rs: "rust",
  sh: "bash",
};

function describe(name: string): {
  name: string;
  kind: "markdown" | "code";
  language: string | null;
} {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const language = CODE_LANGUAGES[extension];

  if (language) return { name, kind: "code", language };

  // Plain text imports become Markdown: the editor writes Markdown syntax, so
  // a .txt name would misdescribe the file.
  const renamed = /\.txt$/i.test(name) ? name.replace(/\.txt$/i, ".md") : name;
  return { name: renamed, kind: "markdown", language: null };
}

export function DesktopBridge() {
  const router = useRouter();

  useEffect(() => {
    const api = (window as unknown as { nested?: DesktopApi }).nested;
    if (!api) return;

    function onDirty(event: Event) {
      const detail = (event as CustomEvent<{ dirty: boolean }>).detail;
      void api?.setDirty?.(detail.dirty === true);
    }

    window.addEventListener("nested:dirty", onDirty);

    const unsubscribe = api.onFileOpened?.((file) => {
      void (async () => {
        const shape = describe(file.name);
        const created = await createFile({
          folderId: null,
          name: shape.name,
          kind: shape.kind,
          language: shape.language,
        });

        if (created.ok && created.id) {
          await saveFile(created.id, file.content, 1);
        }

        router.refresh();
      })();
    });

    return () => {
      window.removeEventListener("nested:dirty", onDirty);
      unsubscribe?.();
    };
  }, [router]);

  return null;
}

# Ideas

Candidate work that is deliberately **not built**. Nothing here is a promise;
each entry says what it costs so a decision can be made quickly.

## How file types work today

Two enums in Postgres drive the whole editor:

- `files.kind` — `markdown` | `code`
- `files.language` — `python`, `javascript`, `typescript`, `html`, `css`, `java`,
  `cpp`, `go`, `rust`, `sql`, `bash` (only when `kind = 'code'`)

`markdown` is plain text on purpose (SPEC §1 non-goals: no rendering, no preview).
`src/lib/languages.ts` is the single source of truth for what each language does,
and [adding-a-language.md](adding-a-language.md) already documents the two-step
migration needed for a new enum value.

So there are two very different kinds of "new file type":

1. **A new language** — one enum value, an entry in `languages.ts`, an extension
   mapping, optionally a highlighter and a runner. Cheap. No schema shape change.
2. **A new kind** — changes `file_kind`, the new-file dialog, icons, the editor
   shell, the file header, and every place that asks "is this a code file?". Expensive.

## Ranked: new languages

| Idea | Fit | Cost | Notes |
|---|---|---|---|
| **Mermaid** (`.mmd`) | High | Low–medium | Render `graph TD …` to SVG in the preview pane, the way HTML/CSS already preview. Text stays the source of truth, so versions work for free. Needs mermaid.js (~1 MB unpacked) loaded on demand, a dark theme, and SVG sanitising. |
| **JSON** (`.json`) | High | Low | Highlighting plus `JSON.parse` validation and a Format button. This is the most-used "not quite code, not quite notes" file there is. |
| **YAML** (`.yaml`, `.yml`) | High | Low | Same as JSON, validating with a small parser. Config files are the second half of the same gap. |
| **Plain text** (`.txt`) | Medium | Low | A kind would be overkill; a `plain` language with no highlighting and no formatter gives the same result inside `code`. |
| **TOML** (`.toml`) | Medium | Low | Cheap once YAML exists. |
| **SQL dialect split** (`.pgsql`, `.mysql`) | Low | Low | Cosmetic; the current `sql` covers it. |

**Shipped:** `json` and `yaml` (both `checks` tier — parsed in the browser, and
Run prints the parsed result). `yml` maps to YAML.

**Still open:** `mermaid`, which needs a preview component and SVG sanitising
rather than just an enum value.

## Ranked: new kinds

| Idea | Fit | Cost | Notes |
|---|---|---|---|
| **Diagram** (`.mmd` promoted) | High | Medium | Only worth it if Mermaid proves popular: it removes the language picker for that file and gives the kind its own icon. Mechanically: `file_kind` gains `diagram`, `language` stays null, editor swaps to preview-first. |
| **Checklist / todo** | Medium–high | Medium | Markdown plus interactive `- [ ]` checkboxes. Toggling writes back to the source, so the file stays text. Contradicts the "markdown never renders" decision, so it needs a SPEC change first. |
| **Table / CSV** (`.csv`) | Medium | High | A grid editor means a second editor surface: selection, undo, validation, delimiter handling, large-file limits. Much bigger than it looks. |
| **Notebook** (`.ipynb`) | Low–medium | Very high | Cells, kernels, outputs. The browser runner covers the useful 10%; the remaining 90% is a different product. |
| **Canvas / whiteboard** | Low | Very high | Needs image/blob storage, which the storage model and 25 MB quota were built to avoid. |
| **Slides / deck** | Low | High | Not what a notes-and-code tree is for. |

## Ten more features

Ordered by value for cost. None of these are file types.

| # | Idea | What it does | Cost |
|---|---|---|---|
| 1 | **Quick capture** | A small always-available box that appends a line to `inbox.md` at the top level, then gets out of the way. Removes the tree navigation from the most common action: writing something down before it is lost. | Low |
| 2 | **Templates** | "Save as template" on any file; the new-file dialog gains a second column of templates. A project becomes repeatable without copy-paste. | Low–medium |
| 3 | **Duplicate** | Fork a file or a whole folder in one action, with `(copy)` naming and its own versions. Today this is manual. | Low |
| 4 | **Pinned files** | A fixed row above the tree for the three or four files open all day, independent of where they live. | Low |
| 5 | **Folder colours and icons** | Orientation in deep trees, stored as a column on `folders`. Pure UI, no behaviour change. | Low |
| 6 | **Snapshot diff** | `restore_project` is all-or-nothing. Show which files a snapshot changed, and a line diff before restoring. Makes history usable rather than theoretical. | Medium–high |
| 7 | **Version notes** | `versions.label` already exists and is never shown. Add "Save with a note" so a version list reads like a changelog. | Low |
| 8 | **Project export as zip** | The JSON export is for machines. A zip of `.md`/`.py`/`.json` files is for people and for leaving. | Medium |
| 9 | **Command palette** | `Ctrl/Cmd+K`: jump to a file, create one, switch project, open settings. The tree stops being the only navigation. | Medium |
| 10 | **Focus mode** | Hide the sidebar and the header arrows, widen the editor. One keyboard shortcut, remembered per account. | Low |

**Shipped:** 3 (duplicate), 4 (pinned files and folders), 7 (version notes),
8 (project zip export).

Two more that are close to free and worth folding into whichever ships first:

- **Language badge in the file header** — `languages.ts` already knows whether a
  language runs, previews, checks or needs a tool; showing it saves a click.
- **Shortcut sheet** — press `?` for the list. The app already has a lot of
  undiscoverable keyboard behaviour (F2, space, arrow keys, Ctrl+Enter).

## For programmers

Ideas chosen because the app is used to think in code, not only to store it.

| # | Idea | Why a programmer wants it | Cost |
|---|---|---|---|
| 1 | **Version diff** | Two versions side by side, line added/removed. Restoring without seeing the difference is guesswork. | Medium–high |
| 2 | **Runner fixtures** | Save stdin, arguments and expected output per file, next to the code. Turns the runner from a demo into a test bench. | Medium |
| 3 | **Project-wide find and replace** | Search every file for a string or regex, with a result list and replace-all. The tree has no content search at all. | High |
| 4 | **Snippet library** | A top-level `snippets` project whose files are insertable from the editor. Boilerplate without retyping. | Low–medium |
| 5 | **Import a gist or raw URL** | Paste a link, get a file with the right language. Fastest way to bring outside code in. | Medium |
| 6 | **In-editor todo scan** | Collect `TODO`, `FIXME` and `XXX` across the open project into one list. Cheap and immediately useful. | Low |
| 7 | **Line links** | Copy a link to `file:line` that opens the file scrolled and highlighted. Useful when pasting notes into issues. | Low–medium |
| 8 | **Duplicate with a name** | Today duplicates always become "(copy)". Asking for the name makes "v2 before refactor" trivial. | Very low |
| 9 | **File stats** | Lines, characters, indent style, longest line, trailing whitespace, shown on demand. A lint-lite pass with no toolchain. | Low |
| 10 | **Run selection** | Execute only the highlighted lines in the runner. Experimentation without deleting surrounding code. | Medium |

None of these need a second service: everything runs in the browser or in
Postgres, which is the constraint that keeps the free tier viable.

## Explicitly not doing

- Markdown rendering as a default view — the SPEC rules it out; a checklist kind
  would need that decision revisited, not quietly overridden.
- Image uploads — breaks the storage model and the quota maths.
- Anything requiring a second backend or a background worker; the free-tier
  budget is the constraint the whole design rests on.

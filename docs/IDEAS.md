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

**Shipped:** 3 (duplicate), 4 (pinned files and folders), 7 (named versions),
8 (project zip export), 9 (command palette).

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

## Why people stay on GitHub, PyCharm and Google Docs

Honest reasons, and what would actually move someone. The goal is not to beat
these tools; it is to win the twenty minutes before them.

| Tool | Why people pick it | What Nested can do about it |
|---|---|---|
| **GitHub** | It is where code is expected to live. Commit history you can diff, pull requests, issues, collaborators, off-site backup, a public profile that says "I am a developer", and green squares that make consistency visible. | Do not fight git for committed work. Win the pre-commit layer: portable zip export, a real line diff in the version browser, and no repository to create. Long term, a one-way "send this project to a repo" is the honest bridge, not reimplementing branches. |
| **PyCharm / VS Code** | Refactoring, go-to-definition, debugging, test running, terminal, completion, git integration, and project-wide rename. A whole project is loaded, indexed, and understood. | Never compete on IDE depth. Compete on zero setup: open a browser, a file is editable in a second, from any machine. Add the few IDE affordances that are cheap here — run selection, runner fixtures, line links, project-wide find. Be the tab next to the IDE, not a replacement. |
| **Google Docs** | Rich text, comments, suggestion mode, sharing with one link, mobile apps, offline editing, and total familiarity. It is the default for prose. | Do not add rich text. Instead make the bridge trivial: paste Markdown in and keep it, copy out cleanly, and let notes-on-anything absorb the context people currently bury in comments. The wedge is code next to prose, which Docs cannot do at all. |

### The deeper reasons

- **Trust.** GitHub is someone else's computer with backups and an uptime record.
  Nested is one Postgres instance on a free tier with no vendor backups. Export is
  the mitigation, and it should be one click, obvious, and mentioned in Settings.
- **Retrieval.** No full-text search means people fall back to tools that have it.
  Version history does not help you find the file you forgot the name of.
- **Import friction.** Work already exists elsewhere. Paste is the only door right
  now; a zip or gist import would remove the setup cost of trying Nested at all.
- **Identity and sharing.** GitHub is a portfolio; Docs is a collaboration surface.
  Nested is deliberately private, so it cannot be either. Accept that, and stop
  trying to win the case where someone needs to send a link.
- **Habit and muscle memory.** Thousands of shortcuts already learned. The command
  palette, familiar editing keys, and a shortcut table reduce the cost of a second
  tool, but they will not beat the first.

### What actually converts people

1. **A minute of value.** The welcome document exists for this. So does zero
   signup ceremony beyond Google, and a file openable in one click.
2. **Loss that is visible.** Named versions and side-by-side apply are the feature
   people miss after they have been burned once by an editor's undo stack.
3. **Portability.** If leaving is cheap, trying is cheap. Zip export and JSON
   export should be advertised, not buried.
4. **Speed over completeness.** Command palette, quick capture, and paste-a-file
   beat feature parity every time.
5. **Search, eventually.** It is the one missing capability that makes people
   leave for a tool that has it.

## Explicitly not doing

- Markdown rendering as a default view — the SPEC rules it out; a checklist kind
  would need that decision revisited, not quietly overridden.
- Image uploads — breaks the storage model and the quota maths.
- Anything requiring a second backend or a background worker; the free-tier
  budget is the constraint the whole design rests on.

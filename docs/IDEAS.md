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

## More ideas

Unsorted, cheap to expensive. The first six are the ones I would actually pick.

| Idea | What it is | Cost |
|---|---|---|
| **Open tabs** | A row of recently opened files above the editor, with close buttons and the dirty marker. Today opening a second file replaces the first, which makes comparing a note against code impossible. | M |
| **Split view** | Two files side by side, each with its own editor and save button. The natural end point of tabs, and the one thing a browser can do that a terminal cannot. | L |
| **Breadcrumb in the header** | `project / folder / file` above the editor, each segment clickable to reveal it in the tree. Cheap orientation for deep trees. | S |
| **Unsaved guard** | A dirty marker in the tab title plus a `beforeunload` warning and a palette entry to jump to the dirty file. Drafts exist, but nothing tells you one is waiting. | S |
| **Storage breakdown** | In Settings: biggest files, biggest version histories, total per project, with one-click prune of old versions. The 25 MB cap is invisible until it bites. | M |
| **Duplicate detection** | Group files by `content_hash` and offer to trash the extra copies. Storage is the real constraint on the free tier. | S |
| **Bulk move** | Multi-select currently only deletes. Add "move to folder" with the same picker as the tree. | M |
| **Drag out / drop in** | Drag a file row to the desktop to download it; drop a file onto a folder to import it. Removes the copy-paste step. | M |
| **Inline version scrubber** | Drag through a file's versions in the header, like the landing page demo. Faster than opening the versions dialog. | M |
| **Cursor and scroll memory** | Reopening a file returns to the last cursor position and scroll offset, stored per file. | S |
| **Markdown outline** | A panel listing headings from a markdown file, click to jump. No rendering, just structure. | S |
| **Line deep links** | `/app?f=<id>&line=42` scrolls and highlights; a "copy link" action on the current cursor line. | S |
| **Undo toast** | After a delete, a short "moved to trash · undo" notice. The trash exists, but the moment of regret is not met. | S |
| **Fold / unfold all** | One action to collapse or expand every folder, or one project. | S |
| **New file inline** | `Ctrl+Alt+N` creates a file in the focused folder with an inline name input, no dialog. | S |
| **Tree filter** | A search box above the tree that filters visible rows by name, independent of the palette. | S |
| **Run history** | Keep the last few outputs per file so a run does not disappear when you edit. | M |
| **Project templates** | On creating a project, choose a shape: empty, notes, snippets, coursework. | S |
| **File info panel** | Kind, language, size, revision count, created, project, notes in one place. | S |
| **Print / plain export** | Send a markdown file to the browser print dialog or download it individually. | S |

## New batch

Second pass, avoiding anything already shipped or on [ROADMAP.md](ROADMAP.md).

### Editing and navigation

| Idea | What it is | Cost |
|---|---|---|
| **Go to line** (`Ctrl/Cmd+G`) | Jump to a line number in the open file. Small, expected, missing. | S |
| **Scratch buffer** | An unsaved tab for temporary work; closing prompts "save as file". Removes the friction of creating a file to test an idea. | M |
| **Reopen closed tab** (`Ctrl/Cmd+Shift+T`) | A stack of recently closed tabs, not just files. | S |
| **Symbol outline** | A panel listing functions, classes and headings from the open file, click to jump. The grammar already produces the tree. | M |
| **Indent guides + bracket colours** | Two CodeMirror extensions; makes nested code readable at a glance. | S |
| **Cross-file completion** | Offer identifiers from other open files in the same project. The start of "this feels like an IDE". | L |
| **Format on save** | A setting, off by default, that runs the existing formatter before writing. | S |
| **Language follows the extension on rename** | Rename `notes.md` to `notes.py` and the language, icon and run button update with it. | S |
| **Minimap** | A scaled overview strip; useful for long files, optional per account. | M |

### Structure and knowledge

| Idea | What it is | Cost |
|---|---|---|
| **Wiki links** | Type `[[` in a note to link another file by name; the link opens it. Turns a tree into a wiki without leaving text. | M |
| **Backlinks** | For the open file, list every other file that mentions it. Pairs with wiki links. | M |
| **Tags** | `#topic` in notes, plus a tag filter that lists files across projects. | M |
| **Saved searches** | A named query (name, tag, language, modified date) shown as a virtual folder. | L |
| **Tree previews** | Hover a file row to see its first lines, and a project row to see its file count and size. | S |

### History and recovery

| Idea | What it is | Cost |
|---|---|---|
| **Diff two files** | Split view already exists; add "compare with…" to diff any two files, not just versions. | M |
| **Trash preview** | Open a trashed file read-only before restoring it. Right now restoring is a guess. | S |
| **Version retention policy** | Keep the newest N versions and the named ones; auto-prune the rest. Directly protects the 25 MB cap. | M |
| **Bulk restore** | Select several trashed items and restore at once. | S |

### Small workflow wins

| Idea | What it is | Cost |
|---|---|---|
| **Copy internal link** | `nested://`-style link (or `/app?f=…&line=…`) that opens a file at a line. | S |
| **Import from clipboard** | Palette action: "new file from clipboard", language guessed from content. | S |
| **Download this file** | Single-file download next to export-project. | S |
| **Selection stats** | Lines, words and characters selected, in the status corner. | S |
| **Tab overflow menu** | When tabs exceed the width, a dropdown of the rest instead of pure scrolling. | S |

**Shipped from this batch:** reopen closed tab, indent guides, rainbow brackets,
file-to-file diff, trash preview, bulk restore, and version retention pruning.

### The three I would build first

1. **Go to line + reopen closed tab + import from clipboard** — an afternoon, and every one is a habit-forming shortcut.
2. **Wiki links + backlinks** — turns the tree into something you navigate by association, which is the closest thing to a moat a notes app can have.
3. **Trash preview + version retention** — makes recovery trustworthy and keeps storage from ever surprising anyone.

## Explicitly not doing

- Markdown rendering as a default view — the SPEC rules it out; a checklist kind
  would need that decision revisited, not quietly overridden.
- Image uploads — breaks the storage model and the quota maths.
- Anything requiring a second backend or a background worker; the free-tier
  budget is the constraint the whole design rests on.

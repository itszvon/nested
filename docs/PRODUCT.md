# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who keeps organised reference material, research notes, and code side by
side, with programmers as the primary audience.

The typical session: a developer working on several things at once, keeping
snippets, decisions, and half-finished files that belong to a project but do not
belong in that project's git repository. They arrive from a browser tab, not an
IDE, and they may be on a different machine than yesterday.

Secondary audiences: students keeping coursework and notes together, writers
keeping outlines and drafts. Both are served by the same structure and are not
designed for separately.

## Product Purpose

A private place to store text and code in folders nested as deeply as the work
demands, with explicit saves and a per-file history you can return to.

Success looks like: opening the app and finding the file in a few seconds,
saving without ceremony, and being able to recover any state that was ever
saved. Failure looks like: losing work, or feeling obliged to tidy up before
starting.

## Positioning

Nested combines three things that currently require two tools: a filesystem-like
hierarchy, a real code editor, and version history on every file, without a
commit workflow, a branch, a remote, or a repository to set up.

GitHub is too much machinery for a note that happens to contain code. Google
Docs handles prose but cannot edit code and has no notion of a file tree. PyCharm
is a project IDE, not a place to keep a week of loose reasoning. Nested takes the
useful half of each and drops the ceremony.

## Operating Context

- Desktop browser, wide window, long sessions.
- Keyboard-driven: command palette, tree navigation, save and run shortcuts, an
  editor that behaves like one the user already knows.
- Multiple devices, one account, no sharing.
- Work arrives by paste: a snippet, a decision, a fragment, a whole file.
- Saves are deliberate. The user decides when something becomes permanent.

## Capabilities and Constraints

### Authentication

- Google is the only sign-in method.
- The Email provider is enabled for one reason: username and email changes are
  confirmed by a six-digit code sent to the account address (and, for an email
  change, to the new address). It is a mailer, not a second login route.
- Username and email changes require that emailed code. Display name and picture
  do not.
- No guests, no public links, no sharing. Every row is tied to one account and
  protected by row-level security.

### Files

- Two kinds: **markdown** (plain text, never rendered) and **code**.
- Code languages: Python, JavaScript, TypeScript, Java, Go, Rust, C++, SQL, Bash,
  HTML, CSS, JSON, YAML. The picker lists HTML and CSS together, so it shows
  twelve entries.
- Execution tiers, stated in the UI rather than implied:
  - **runs here** — JavaScript, TypeScript (types erased), Python, SQL.
  - **preview only** — HTML, CSS.
  - **checked here** — JSON and YAML are parsed; Run prints the parsed result.
  - **external tool** — Java, Go, Rust, C++, Bash are edited, highlighted and
    checked, and the Run button says what to use instead.
- Formatting exists only where a formatter is bundled (Prettier for JS, TS, HTML,
  CSS, JSON; Ruff for Python; clang-format for C++; prettier-plugin-java for
  Java). The button hides otherwise.
- Arbitrary folder depth. Projects are top-level folders; loose files may sit
  above them.
- Duplicate copies a file or a whole folder subtree, content only, keeping the
  extension intact.
- Pinning works for files and folders; pins are a separate strip, not a reorder.
- Any file or project can carry plain-text **notes**, edited independently of the
  file content.
- Export: the whole account as JSON in Settings, and any project as a zip of real
  files.

### Saving and history

- Nothing is written to the server without a button press: Save File or Save
  Project. Local drafts exist only to survive a crash.
- Saving asks for a version name; the name appears in history.
- Every save appends an immutable version. Versions are never mutated, only
  inserted or deleted.
- Save Project records a snapshot of every changed file at once, with a message.
- `/settings/versions` lists every file and project, compares any saved version
  with the current file (or with another version) side by side, and applies
  either side as a new revision.

### Recovery and limits

- Trash holds deleted files and folders for 30 days; permanent deletion is a
  separate, explicit action. Files can be previewed before restoring, and several
  items can be restored at once with the same selection pattern as the tree.
- Version retention can be pruned: keep the newest N versions per file plus every
  named one.
- Limits: 2 MB per file, 25 MB per account, 2,000 files, 500 folders.
- Free infrastructure tier, so the product is deliberately small in scope.

### Interface

- Dark theme only.
- Open files in **tabs**, with one optional **split view** pane beside the primary
  file. Both panes edit and save independently; shortcuts follow the pane you last
  touched.
- A breadcrumb above each pane shows `project / folder / file`; clicking a folder
  segment reveals that row in the tree. Long paths collapse their middle.
- Code files show indent guides and depth-coloured brackets; the last closed tab
  reopens with `Ctrl/Cmd+Shift+T`.
- Any two files can be compared in a side-by-side line diff, independent of the
  version browser.
- Command palette on Ctrl/Cmd+K over file and folder names plus a few actions.
- A shortcut table in Settings documents every keyboard action.
- An onboarding document is created for every new account.
- A plain, dense interface: monospace labels, 1px rules, one accent colour.

## Brand Commitments

- Name: Nested.
- Dark only. No light theme, no theme toggle.
- Deliberately plain interface. The user's stated position: the value is
  functionality, not decoration.
- Further visual constraints may be given as work proceeds; nothing else is
  binding yet.

## Evidence on Hand

None. No customers, testimonials, press, benchmarks, or logos exist. Future work
must not invent any.

## Product Principles

1. **Never lose work silently.** Explicit saves, immutable versions, local
   drafts, and a trash that holds for 30 days. Every one of those exists to
   make loss recoverable.
2. **The structure is the feature.** Arbitrary depth, fast navigation, and
   nothing between the user and their file.
3. **Assume competence.** Dense information, keyboard shortcuts, no wizardry,
   no tooltips explaining what a folder is.
4. **The interface recedes.** No ceremony, no engagement mechanics, no empty
   space filled with suggestions. A file opens and is editable within a second.
5. **Deliberate over automatic.** The user decides when something is saved,
   restored, or deleted. Automation is limited to protecting against loss.
6. **Say what a language can do.** The picker, the header and the runner read
   from one source, so nothing claims to run in one place and refuses in another.

## Accessibility & Inclusion

No specific standard has been established by the product.

The spec commits to keyboard-only operation of the tree and editor, visible focus
rings, ARIA tree semantics, and a 4.5:1 contrast minimum. The command palette and
every dialog are reachable without a pointer.

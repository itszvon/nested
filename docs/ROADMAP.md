# Roadmap checklist

Ordered by what would actually make the site better for the reasons recorded in
[IDEAS.md](IDEAS.md): trust, retrieval, cheap entry, and legible history. Boxes
are unbuilt unless noted. Effort is a rough size, not a promise.

## P0 — do these first

### The work must survive

- [ ] **Nightly logical backup.** `pg_dump` to a private object store or a second
      region, retained 30 days. Free tier has no vendor backups; this is the only
      thing standing between a bad migration and total loss. (M)
- [ ] **A tested restore.** A written runbook plus one real restore into a scratch
      project. An untested backup is a story, not a backup. (S)
- [ ] **Sentry actually configured.** DSNs are wired but absent, so nothing is
      reported. Set both client and server DSNs and route to email. (S)
- [ ] **Uptime alert on `/api/health`.** The route exists and is polled; nobody is
      told when it fails. Point a free monitor at it. (S)
- [ ] **Advertise export.** "Download everything" is one line in Settings today.
      Give it a plain-language line in the app and on the landing page: leaving is
      cheap. (S)

### People must be able to find things

- [ ] **Full-text search.** The single biggest reason someone leaves for a tool
      that has it. Postgres `tsvector` over `files.content` and `files.name`, with
      results in the command palette and a dedicated view. (L)
- [ ] **Recent files** in the palette before anything is typed. (S)
- [ ] **Project-wide find and replace**, reusing the same index. (L)

## P1 — next

### History that reads like a changelog

- [ ] **Line diff** in the version browser: additions and deletions highlighted,
      not two plain panes. (M)
- [ ] **Snapshot contents**: before restoring a project snapshot, show which files
      changed and restore a single file from it. (M)
- [ ] **Name project saves** in the save dialog, matching named file versions. (S)

### Make trying cheap

- [ ] **Import a zip** into a project, preserving nested paths. The inverse of the
      export that already exists. (M)
- [ ] **Import from a URL or gist**: paste a link, get a file with the right
      language detected from its extension. (M)
- [ ] **Quick capture**: one box that appends a line to `inbox.md`, reachable from
      the palette. Removes the tree from the most common action. (S)

### Quality floor

- [ ] **Clear the existing lint errors** (setState-in-effect in dialogs, unescaped
      entities on legal pages) so `npm run lint` is a real gate again. (S)
- [ ] **Tests for the pure modules**: tree assembly, whitespace tidying, copy
      naming, path building for export. Small and fast, no browser needed. (M)
- [ ] **Accessibility pass**: focus order in dialogs and palette, contrast of
      `ink-faint` on `ground`, tree ARIA, keyboard-only flows. (M)
- [ ] **Throttle confirmation emails per account** and show the remaining wait,
      instead of relying on the provider's raw 60-second message. (S)

## P2 — worth doing, not urgent

### Coding ergonomics

- [ ] **Run selection**: execute only the highlighted lines. (M)
- [ ] **Runner fixtures**: save stdin, arguments and even expected output per file. (M)
- [ ] **TODO scan**: collect `TODO`, `FIXME`, `XXX` across a project into one list. (S)
- [ ] **File stats**: lines, indent style, longest line, trailing whitespace. (S)
- [ ] **Duplicate with a name** instead of always `(copy)`. (S)
- [ ] **Line links**: copy `file:line` that opens scrolled and highlighted. (M)
- [ ] **Mermaid** as a preview language for diagrams-as-text. (L)

### Reach

- [ ] **Read-only offline cache** (PWA): the tree and recently opened files
      available without a connection, edits still explicit. (L)
- [ ] **Mobile pass** on the editor: drawer, touch target sizes, keyboard behaviour. (M)
- [ ] **A real sender domain** with SPF/DKIM/DMARC, replacing the Brevo rewrite. (M)
- [ ] **Changelog / status page**, so a deployment failure is visible rather than
      discovered by a 404. (S)

## Deliberately absent

- Sharing, public links, comments, collaboration.
- Rich text or Markdown rendering.
- Git, branches, remotes, pull requests.
- Image or file uploads (outside zip import, which is bounded and explicit).
- Any second backend or background worker; the free-tier budget is the design.

## If only five things happen

1. Nightly backup + a tested restore.
2. Sentry and uptime alerts wired.
3. Full-text search.
4. Line diff in the version browser.
5. Zip import.

Those five cover trust, retrieval, and cheap entry — the three reasons people
stay on the tools [IDEAS.md](IDEAS.md) compares against.

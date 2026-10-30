# Nested — Specification

Status: draft for review
Version: 0.4
Date: 2026-10-30

## 1. Product summary

Nested is a private, Google-authenticated web app for storing plain text and code inside an arbitrarily deep folder tree, with explicit manual saves, per-file version history, and a trash bin.

One user, one account, many devices. No sharing, no public links, no guests.

The value is function: find a file fast, write it, save it, get an older state back, recover something you deleted. The interface stays quiet and out of the way.

### Non-goals for v1

- Collaboration, shared folders, public links
- Live multi-device co-editing (conflicts are detected, not merged)
- File uploads, attachments, images
- Markdown rendering, rich text, WYSIWYG
- Global search (v1.1)
- Import/export
- Native mobile apps

## 1.1 Operating budget

Nested runs at zero cost on free tiers, for a small public user base.

| Resource | Free tier | What it gives us |
|---|---|---|
| Supabase Postgres | 500 MB | Files, folders, versions, snapshots |
| Supabase Auth | unlimited MAU | Google sign-in, no email sending |
| Vercel Hobby | 100 GB bandwidth | Hosting and server actions |
| Sentry | 5k errors/month | Client and server error reporting |
| Uptime monitor | free tier | Outside-in health check |

Consequences that are baked into this spec:

- **Per-user storage quota of 25 MB** (files + versions + trash). Postgres TOAST compresses text roughly 3x, so the physical footprint is nearer 8–10 MB per user, which supports roughly 30–60 users inside 500 MB. This is a small-scale ceiling, not a growth plan.
- **Hard caps** of 2,000 files and 500 folders per user, to stop a single account from exhausting the database.
- **Keep-alive**: the free database pauses after 7 days without requests. A daily cron ping keeps it awake. If it pauses anyway, sign-in fails until it is restored manually.
- **No vendor backups on this tier.** See section 11.
- Vercel's Hobby tier is for non-commercial use. A free app with no revenue sits inside that, but the moment it earns anything it needs Pro or Cloudflare.

## 2. Glossary

- **Project** — a top-level folder. The sidebar lists projects; each expands into its own unlimited tree.
- **Root area** — the level above projects. Holds projects and loose files. No subfolders at root.
- **Loose file** — a file whose parent is the root area, belonging to no project.
- **Markdown file** — the non-code file type. Plain text: no highlighting, no formatting, no rendering, no preview. The name describes intent, not behaviour.
- **Code file** — one of five languages, highlighted and formattable.
- **Version** — an immutable snapshot of one file's content, created by a save.
- **Snapshot (project save)** — a group of versions, one per changed file in a project.
- **Dirty buffer** — editor content that differs from what is stored in the database.
- **Draft** — a locally stored copy of a dirty buffer, for crash recovery only. Never sent to the server without a button press.
- **Trash** — deleted files and folders, retained 30 days.

## 3. Authentication and security

- Google OAuth only, via Supabase Auth. Every other provider, email/password, magic links, and anonymous sign-in disabled.
- Every request resolves to a session; unauthenticated users go to `/login`.
- All rows carry `owner_id`. Row Level Security on every table, restricted to `owner_id = auth.uid()`. No `anon` policies.
- Cross-ownership integrity: a file or folder write requires the destination parent to be owned by the same user, enforced in triggers.
- No service-role key in the browser. Mutations run through server actions as the signed-in user, calling `security invoker` RPCs with an empty `search_path`.
- Deletes move to trash. Permanent deletion requires an explicit action and is confirmed.
- Signups are open but bounded by the quota system. When the database is near capacity, new sign-ins are refused with an explicit message rather than accepted and starved.

## 4. Data model

### profiles
| column | type | notes |
|---|---|---|
| id | uuid PK | references auth.users, cascade |
| email | text | from Google |
| username | text | unique, 3–32 chars, lowercase letters/digits/underscore, derived from the email local part with a numeric suffix on collision |
| storage_bytes | bigint | maintained by triggers across files and versions |
| created_at | timestamptz | |

### folders
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | indexed |
| parent_id | uuid null | references folders, cascade. `null` = project root |
| name | text | 1–255 chars, no `/`, trimmed, not `.` or `..` |
| sort_order | int | manual ordering within parent |
| deleted_at | timestamptz null | set when this folder is trashed |
| trash_root_id | uuid null | id of the item the user actually deleted; set on every descendant of a trashed folder |
| created_at / updated_at | timestamptz | |

Rules:
- Name unique per `(owner_id, parent_id)` among non-deleted rows, case-insensitive.
- A project root cannot be moved inside another folder.
- A folder can never become its own ancestor, checked by recursive walk in a trigger.
- Trashing a folder trashes its whole subtree in one transaction and stamps the same `trash_root_id`.

### files
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | |
| folder_id | uuid null | references folders, cascade. `null` = root area |
| project_id | uuid null | denormalized top-level ancestor id, `null` for loose files, trigger-maintained |
| name | text | 1–255 chars, no `/`, unique per `(owner_id, folder_id)` among non-deleted rows |
| kind | enum | `markdown` \| `code` |
| language | enum null | `python` \| `java` \| `javascript` \| `html` \| `css` \| `cpp`. Non-null iff `kind = 'code'` |
| content | text | last saved content. Never written by a timer |
| content_hash | text | sha256 |
| byte_size | int | ≤ 2,097,152 |
| revision | int | starts at 1, incremented on every save |
| deleted_at | timestamptz null | |
| trash_root_id | uuid null | |
| created_at / updated_at | timestamptz | |

Partial unique indexes exclude trashed rows, so a trashed `notes.md` does not block a new one. Restoring a name collision appends ` (restored)`.

### snapshots
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | |
| project_id | uuid | |
| message | text null | ≤ 200 chars |
| file_count / total_bytes | int | |
| created_at | timestamptz | |

### versions
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid | |
| file_id | uuid | references files, cascade |
| source | enum | `file` \| `project` \| `auto` |
| snapshot_id | uuid null | |
| label | text null | |
| content | text | never mutated |
| content_hash | text | |
| byte_size | int | |
| source_revision | int | |
| created_at | timestamptz | |

- Immutable: insert and delete only.
- Unlimited count, bounded by the user's storage quota.
- Never created with content identical to the file's most recent version.
- Deleting a version is permanent; versions are not sent to trash.

### 4.1 Limits

| Limit | Value | Enforced |
|---|---|---|
| File size | 2 MB | check constraint + editor |
| Files per user | 2,000 | RPC + trigger |
| Folders per user | 500 | RPC + trigger |
| Storage per user | 25 MB (files + versions + trash) | `profiles.storage_bytes` + RPC guard |
| Trash retention | 30 days | nightly purge |

Over-quota saves are refused with a message naming the number of bytes to free and linking to the versions menu and trash. Nothing is silently truncated.

### 4.2 Indexes

- `folders (owner_id, parent_id, sort_order) where deleted_at is null`
- `folders (owner_id, lower(name), parent_id) unique where deleted_at is null`
- `files (owner_id, folder_id, lower(name)) unique where deleted_at is null`
- `files (owner_id, project_id) where deleted_at is null`
- `files (owner_id, deleted_at)` for trash listing
- `versions (file_id, created_at desc)`
- `versions (snapshot_id)`

### 4.3 Loading

- One query returns all folders and file metadata for the user, excluding trashed rows; the tree is assembled client-side.
- File content loads on open only.
- No per-folder queries.

## 5. Tree behaviour

- Sidebar lists root-area files, then projects, each expandable, then a Trash entry at the bottom.
- Create folders inside any folder, at any depth. Create files inside any folder or at root.
- Rename inline (F2), Enter commits, Escape cancels.
- Delete moves to trash with a confirmation stating the counts.
- Drag and drop to move files and folders within a project, and files across projects. Project roots are not draggable.
- Move errors as toasts: name collision, project-into-folder, cycle attempt.
- Keyboard: arrows navigate, Enter opens, F2 renames, Delete trashes.
- Dirty buffers marked with a dot.
- Expanded state and selected file persist per device in `localStorage`.

### Trash

- Lists top-level trashed items with their original path, deletion time, size, and days remaining.
- **Restore** returns the item and its subtree to its original parent, or to the root area if the parent no longer exists. Name collisions get ` (restored)`.
- **Delete forever** purges one item and its subtree, including versions.
- **Empty trash** purges everything after a typed confirmation.
- Restored items reappear with their versions intact.
- Trashed items count against the storage quota, with the byte total shown in the header.

## 6. Editor

### Runtime

- CodeMirror 6. One `EditorView` per open file, created by `<CodeEditor>`, which receives file id, kind, language, initial content, and reports content and dirty state upward.
- Language extension swapped through a `Compartment`; language packs loaded with dynamic `import()`.
- The view's document is the source of truth while typing.

### Undo and redo

Every file type, code and Markdown alike.

- Toolbar buttons plus Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (Ctrl+Y accepted).
- CodeMirror `history` at depth 1,000, per file, per session.
- A formatter run, a restore, or a paste collapses into one undo step.
- Undoing back to the saved content clears the dirty flag and dot.
- Undo never crosses files, never undoes a save, and never undoes a deletion.

### Markdown files

- Monospace, wrap on, line numbers off, spellcheck on.
- No highlighting, no auto-indent, no bracket closing, no formatter, no preview, no language picker.
- Extension is free-form; `.md` is only a default.

### Code files

| Language | Extensions | Picker entry |
|---|---|---|
| Python | `.py` | Python |
| Java | `.java` | Java |
| JavaScript | `.js` | JavaScript |
| HTML / CSS | `.html`, `.css` | HTML/CSS (defaults to `.html`, editable). One entry, two parsers |
| C++ | `.cpp`, `.h`, `.hpp` | C++ |

Features: line numbers, active-line highlight, bracket matching and auto-close, auto-indent, folding, search panel, multi-cursor, word autocomplete, tab size toggle, per-file scroll and undo state for the session.

### Formatting (code only)

Header button and Shift+Alt+F, in a Web Worker via comlink:

| Language | Formatter |
|---|---|
| JavaScript, HTML, CSS | Prettier 3 standalone |
| Java | prettier-plugin-java |
| Python | Ruff (WASM) |
| C++ | clang-format (WASM) |

Failure toasts and leaves content untouched. Each formatter is its own chunk. Formatting changes the buffer, never the database.

### Theme

Dark only. No light theme, no `prefers-color-scheme` branch. One accent colour, one mono family. Direction set through Impeccable `PRODUCT.md` and `DESIGN.md` before any UI code.

## 7. Saving and version control

**The database is written only by a button press.** No timers, no background sync, no server-side autosave.

### Save File

Toolbar above the open file, visible whenever a file is open. Ctrl/Cmd+S. Enabled when the buffer is dirty.

1. Compare `revision`. Mismatch stops and raises the conflict banner.
2. Check quota. Over quota stops and explains.
3. Write content, hash, size, increment revision.
4. Insert a version with `source = 'file'`.
5. Clear the dirty flag and the local draft. Status shows `Saved` and the time.

### Save Project

Next to Save File. Ctrl/Cmd+Shift+S. Disabled for loose files, and when the project has no changes.

1. Persist every dirty buffer in the open file's project, incrementing each revision.
2. Insert one snapshot with timestamp and optional message.
3. Insert a version for every file whose content now differs from its latest version.
4. All in one transaction. A stale revision anywhere aborts everything and names the file.
5. Clear those dirty flags and drafts.

Dirty buffers in other projects are untouched and reported in a toast.

### Versions menu

Per file, newest first: timestamp, source badge (`File save`, `Project save`, `Auto`), message, size, restore and delete. Hide-automatic toggle. Header shows version count and total size against the quota.

### Restore

1. If the buffer differs from every existing version, insert an `auto` version labelled `Before restore of <timestamp>`.
2. Replace the buffer as one undo step. The file becomes dirty; nothing is written until Save File.
3. Toast with Undo, which puts the auto content back in the buffer.

### Delete version

Permanent, after confirmation. Sibling versions from the same project snapshot remain. The snapshot row is deleted with its last version.

## 8. Unsaved work, drafts, and conflicts

### Drafts (crash recovery)

- While a buffer is dirty, it is written to IndexedDB about 500 ms after typing stops, keyed by `(userId, fileId)`, with a timestamp and the base revision.
- Drafts never leave the device. No request is made, nothing reaches Postgres, no version is created.
- On opening a file with a draft that differs from server content: "Restore unsaved changes from <time>?" with Restore and Discard.
- On successful save, discard, or permanent file deletion, the draft is removed.
- Drafts are namespaced per user and cleared on sign-out when discarding.
- If the file was deleted on another device, the draft is still offered, with a warning that saving will restore the file.
- Storage is capped at 5 MB per user in IndexedDB, oldest drafts evicted first.

### Guards

- `beforeunload` warns when any buffer is dirty.
- In-app guards on sign-out and on leaving `/app`. File switching is exempt.

### Conflicts

- Header status: `Saved`, `Unsaved changes`, `Conflict`.
- A revision mismatch on save raises a banner: "This file changed on another device", with Reload theirs and Keep mine. Keep mine snapshots the remote content as a version first, then writes.
- Offline edits stay in memory and in drafts; saving while offline fails with a toast.

## 9. Screens and flows

- `/login` — Google sign-in, product name, dark background.
- `/` — redirects to the app; last file restored from the URL, otherwise the empty state.
- `/app?f=<fileId>` — tree and editor. Open file in the URL so refresh restores the file, not the buffer.
- Empty states: no projects, no file selected, empty folder, empty trash, over-quota.

### New file flow

Name field, type selector (Markdown / Code), language only for code, extension prefilled and editable. If the typed name carries an extension, it is kept; `language` decides highlighting; uniqueness is on the full name.

### New folder flow

Inline at the bottom of the parent's children, name focused.

## 10. UI and design

- Impeccable Operate mode: scanability, consistency, native expectations, brand in detail. Settled in `PRODUCT.md` and `DESIGN.md` before code.
- Fixed sidebar (~280px), editor filling the rest. Toolbar above the editor: file name, dirty state, undo/redo, Save File, Save Project, Versions. The toolbar never scrolls away.
- Dark only. One accent for selection, focus, and the primary action; everything else greyscale.
- One sans for UI, one mono for the editor. 28px tree rows, 13px UI text.
- Instant where it matters: file open, tree expand, typing. No ornamental motion.
- Feedback: toasts for background results, inline banners for conflicts and quota, modals only for destructive confirmations, the new-file dialog, and the optional project message.
- Accessibility: ARIA tree roles, keyboard navigation, visible focus, contrast ≥ 4.5:1.

## 11. Operations

| Concern | Approach |
|---|---|
| Hosting | Vercel Hobby (non-commercial only) |
| Database | Supabase free tier, single project |
| Keep-alive | Daily cron hits `/api/health`, which performs one cheap query. Prevents the 7-day pause |
| Keep-alive failure | Sign-in fails loudly; a manual unpause from the Supabase dashboard restores service |
| Error monitoring | Sentry on client and server, release tags, user id attached, no file content in payloads |
| Uptime | External free monitor on `/api/health`, alerting the owner |
| Trash purge | Nightly cron calls a purge RPC, deleting trash older than 30 days |
| Backups | None on the free tier. Mitigation: a nightly logical dump of the user tables to a private object store, encrypted, retained 7 days. Costs nothing at this data size and is the only defence against a bad migration |
| Cost ceiling | When the database passes ~70% capacity, new sign-ins are refused and the owner is alerted |

## 12. Acceptance criteria

1. Google is the only sign-in method; signed-out users reach no app route.
2. User B reads and writes nothing of user A's, verified at RLS level.
3. Folders nest 20+ levels; create, rename, move, delete and restore survive reload.
4. Files can be created at root and inside any folder.
5. Markdown files open as plain text with no highlighting or formatting controls.
6. Undo and redo work in both types from toolbar and keyboard; restore and format are single steps.
7. Files over 2 MB are refused with a clear message.
8. No write occurs without a button press. A dirty buffer survives file switching, survives a browser crash via drafts, and never reaches the server unprompted.
9. Save File persists content and appends a version. Save Project persists all dirty buffers and appends versions for changed files atomically.
10. Restore reproduces content, leaves the file dirty, and can be undone in one step.
11. Deleting a file or folder moves it to trash; restore returns it with versions intact; purge is permanent and confirmed.
12. Two tabs editing one file produce a conflict prompt, never silent loss.
13. Quota stops saves at 25 MB with an actionable message.
14. Dark only, contrast passes, keyboard-only operation possible.
15. Sentry receives a test error from both client and server; `/api/health` responds and is monitored.

## 13. Open items

- Whole-project restore, version diff view, global search, import/export: post-v1.
- Application-level encryption of file content: post-v1, currently only transport and at-rest encryption provided by Supabase.
- Whether drafts should also sync across devices. Not in v1; it would reintroduce server-side autosave.

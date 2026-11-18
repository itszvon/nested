# Nested — Build Plan

Companion to [SPEC.md](SPEC.md) v0.4. Sizing is relative: S ≈ a sitting, M ≈ a day, L ≈ more than a day.

## Status

Phases 0 to 11 are built. Phase 12 (ship) is not started: no deploy, no live crons, no Sentry DSN, no backups.

Built outside the plan: the landing page at `/home`, the code runner (JavaScript, TypeScript, Python, SQL, HTML/CSS preview), the checks panel, resizable panes, the stop button, multi-select delete, and the per-language status map.

Known gaps: no formatter for Go, Rust, SQL, Bash, Python or C++. Formatting exists for JavaScript, TypeScript, HTML and CSS.

## Stack

- Next.js 15 (App Router) + TypeScript, React 19
- Supabase: Postgres, Auth (Google only), RLS
- Tailwind + shadcn/ui primitives
- TanStack Query for server data, Zustand for tree state and buffers
- CodeMirror 6 + `@codemirror/lang-*`
- comlink Web Worker for formatters
- dnd-kit for tree drag and drop
- IndexedDB (`idb`) for drafts
- Sentry, Vitest, Playwright
- Vercel Hobby

## Phase 0 — Foundations and free-tier plumbing (M)

1. Supabase project, local stack, Google OAuth client.
2. Next.js scaffold, Tailwind, TS strict, lint, tooling Prettier.
3. `serverActions.bodySizeLimit: '4mb'`. Without it, saving a 2 MB file silently fails at the 1 MB default.
4. SSR clients, middleware gate, `/login`, `/auth/callback`, sign-out.
5. `/api/health`: one cheap query, no auth, no data. Used by the keep-alive and uptime cron.
6. `vercel.json` cron: daily `/api/health`. GitHub Actions alternative if Vercel crons are unsuitable.
7. Sentry wired on client and server with release tags; verify a test error from both.

**Verify:** sign in, refresh keeps the session, second browser profile is blocked, a 1.5 MB save round-trips, cron fires locally, Sentry shows both test events.

## Phase 1 — Schema, security, quotas (L)

Migrations in `supabase/migrations`, `supabase db reset` locally, seed with two users, a project, nested folders, files, versions.

1. Enums, `profiles` (with `storage_bytes`), `handle_new_user`.
2. `folders` with `deleted_at` and `trash_root_id`, partial unique indexes.
3. Folder triggers: owner match, name rules, cycle prevention, project-root immutability, `updated_at`.
4. `files` with soft-delete columns, partial indexes, hash/size/project triggers, 2 MB check.
5. `snapshots`, `versions`, indexes.
6. RLS everywhere, no `anon` policies. `security invoker` RPCs, `search_path = ''`, no definer functions.
7. Storage accounting triggers: `profiles.storage_bytes` stays correct across insert, update, delete of files and versions, including trash and purge.
8. RPCs, each transactional and quota-guarded:
   - `save_file(file_id, content, expected_revision)`
   - `save_project(project_id, message)`
   - `restore_version(version_id)`
   - `trash_node(kind, id)` and `restore_node(kind, id)`
   - `purge_trash(older_than)` and `empty_trash(user_id)`
   - `move_node(kind, id, new_parent_id, new_index)`
9. Count and size limits enforced: 2,000 files, 500 folders, 25 MB.
10. Regenerate types, commit them.

**Verify with two JWTs:** isolation both ways; foreign-parent insert fails; folder cannot move under its child; project root cannot be reparented; stale revision writes nothing; 2.1 MB rejected; quota rejects the save that crosses 25 MB; trashing a folder stamps `trash_root_id` on every descendant; `storage_bytes` matches a manual sum after every operation; `save_project` with one stale file writes zero rows.

## Phase 2 — Design direction (M)

1. `/impeccable init` → `PRODUCT.md`.
2. `new-work` → `DESIGN.md`, dark-only tokens: surfaces, borders, one accent, type scale, spacing, radii, focus ring, quota/trash states.
3. Token layer (CSS variables + Tailwind) and shell components: sidebar frame, toolbar, tree row, buttons, menu, dialog, toast, banner.
4. `reference/craft-floor.md` before the first UI edit.

**Verify:** no stray hex outside tokens, contrast passes, focus always visible.

## Phase 3 — Read-only shell and tree (M)

1. One query loads folders and file metadata (excluding trashed), client assembles the tree.
2. Root area, projects, expansion, selection, persisted expand state.
3. Empty states. Not-found state for unknown `?f=` ids.
4. Trash entry visible, empty for now.

**Verify:** 500-folder seed interactive under 100 ms after hydration; 20-deep nesting renders; deep link opens the right file.

## Phase 4 — Tree mutations (M)

1. Create folder inline, rename inline and F2, delete → trash with counts.
2. New-file dialog: name, type (Markdown / Code), language for code only, extension prefilled and editable.
3. Server actions over RPCs, optimistic UI with rollback.
4. Full keyboard navigation.

**Verify:** create, rename, trash, restore survive reload; duplicate names rejected inline; counts accurate.

## Phase 5 — Editor, buffers, drafts (L)

1. `<CodeEditor>`: one `EditorView`, `Compartment` language swap, `history` at 1,000, toolbar undo/redo, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y.
2. Buffer store: `fileId → { text, dirty, savedAt, baseRevision }`.
3. Markdown mode: plain text, wrap, no line numbers, spellcheck.
4. IndexedDB drafts, debounced 500 ms, keyed `(userId, fileId)`, 5 MB cap with oldest-evicted.
5. Recovery on open: the differing draft is restored automatically, with a banner showing the time and Undo / × (dismiss).
6. Guards: `beforeunload`, sign-out, leaving `/app`.

**Verify:** smooth typing on 5,000 lines; buffer survives switching; hard reload restores drafts automatically; Undo restores the saved content and clears the draft; × hides the notice without losing the recovered text; no network request is ever made while typing (network panel check).

## Phase 6 — Saving and versions (L)

Phases 5 and 6 ship as the first usable slice; 5 cannot save on its own.

1. `save_file`: revision check, quota check, write, version insert, draft clear, status update.
2. Conflict banner with Reload theirs / Keep mine.
3. Versions menu: list, badges, timestamps, sizes, hide-automatic, quota header.
4. Restore: auto version, buffer swap as one undo step, Undo toast.
5. Delete version with confirmation; snapshot cleanup.
6. Ctrl/Cmd+S and Ctrl/Cmd+Shift+S with `preventDefault`.

**Verify:** one save equals one version; duplicates blocked; restore leaves the file dirty; deleting a version leaves siblings; stale save writes nothing; over-quota save explains the shortfall.

## Phase 7 — Trash UI (M)

1. Trash view: original path, deleted time, size, days remaining, storage total.
2. Restore with collision handling and parent-missing fallback to root.
3. Delete forever and Empty trash, both confirmed.
4. Nightly purge cron calling `purge_trash`.

**Verify:** trash a folder with 20 files, restore it, everything returns with versions; purge after the retention date removes rows and frees quota; restoring into a deleted parent lands at root.

## Phase 8 — Languages and formatting (L)

1. Language packs per extension, dynamic import, undo preserved across swaps.
2. Formatters one at a time: Prettier (JS/HTML/CSS), prettier-plugin-java, Ruff WASM, clang-format WASM. HTML and CSS are separate parsers behind one entry.
3. Shift+Alt+F and toolbar button; failures toast; single undo step.

**Verify:** format a sample in all five; undo is exact; users who never format download no formatter code.

## Phase 9 — Project saves (M)

1. `save_project`: dirty buffers in the project, one snapshot, changed files only, atomic.
2. Optional message popover; disabled states for loose files and unchanged projects.
3. Toast reporting saved files and files skipped in another project.

**Verify:** two dirty files give one snapshot and two versions; an unchanged third gives none; induced failure leaves zero rows.

## Phase 10 — Move and drag (M)

1. dnd-kit: reorder within parent, move across folders, files across projects, project roots fixed.
2. Server validation with toasts for collisions, cycles, project-into-folder.

**Verify:** twenty random moves survive reload; invalid moves leave no partial state.

## Phase 11 — Hardening (L)

1. File deleted elsewhere, over quota, paused database, offline: each has a real state, not an error boundary.
2. Empty states, skeletons, error boundaries, 404 for foreign ids.
3. Accessibility: ARIA tree roles, focus order, editor labels, keyboard-only walkthrough.
4. Mobile: drawer, compressed toolbar.
5. `impeccable detect --json` over changed UI, one fix batch.

**Verify:** keyboard-only run from login to restore; axe clean; each degraded state reachable and recoverable.

## Phase 12 — Ship (M)

1. Seed a realistic account, check query plans, confirm indexes used.
2. Playwright: sign in, create, save, restore, trash, restore from trash, reload persistence.
3. Vercel deploy, Supabase production project, OAuth redirects, env separation.
4. Crons live: daily keep-alive, nightly purge, nightly encrypted logical dump to private object storage.
5. Sentry release tags, uptime monitor, owner alert.
6. Post-deploy smoke test with a second Google account.

**Verify:** a full week with no manual intervention, database never paused, dump restorable into a scratch project.

## Known risks

| Risk | Mitigation |
|---|---|
| Free database pauses after 7 days idle | Daily health cron; loud failure; manual unpause documented |
| 500 MB shared by public users | 25 MB quota, count caps, sign-in refusal past 70% capacity, storage shown in the versions menu |
| No vendor backups | Nightly encrypted logical dump, 7-day retention |
| Public signups exhausting storage | Quota per user plus a hard cap on total sign-ins |
| Draft store growing unbounded | 5 MB IndexedDB cap, oldest evicted |
| clang-format WASM instability | Isolated chunk, reindent-only fallback |
| RLS gaps in nested ownership | Invoker RPCs plus triggers, two-user tests in phase 1 |
| Vercel Hobby is non-commercial | Free and non-monetised for now; move to Pro or Cloudflare if that changes |

## Ordering

0–2 in order. 3–6 sequential as one slice. 7 and 8 are independent after 6. 9 and 10 are independent after 6. 11–12 last.

## Changes in this revision

1. Free-tier budget made explicit, with quotas, count caps, keep-alive, and a cost ceiling.
2. Trash added end to end: schema, subtree stamping, restore with collision handling, purge cron, own phase.
3. Local IndexedDB drafts and recovery prompt added, so a crash or browser close loses nothing while the database still only receives button presses.
4. Storage accounting, quota enforcement, and their verification added to phase 1.
5. Sentry, uptime, keep-alive, nightly purge, and nightly dumps added as real phases rather than footnotes.
6. Partial unique indexes and soft-delete-aware queries added, since a trashed name must not block a new file.

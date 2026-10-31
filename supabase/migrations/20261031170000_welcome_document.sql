-- Every account starts with a manual.
--
-- The document is a normal markdown file inside a normal project, so it can be
-- read, edited, renamed, or deleted like anything else. It is created by the
-- signup trigger and backfilled for accounts that predate it.
--
-- The text lives in one function so the trigger and the backfill cannot drift.

create or replace function public.welcome_document()
returns text
language sql
immutable
set search_path = ''
as $$
select $guide$# Nested: the short manual

Nested is a private place for notes and code in one tree. One account, many
devices, no sharing. Everything below is true of the version you are using.

## The tree

- Projects are the top-level folders in the sidebar. A project can hold folders,
  and those folders can hold folders, with no depth limit.
- Loose files can sit above every project, at the top level.
- Drag a row to move it. Drop it on a folder to move it inside, or between rows
  to reorder.
- Right-click any row for its menu: notes, duplicate, pin, rename, delete.

## Files

Two kinds:

- **Markdown** files are plain text. No highlighting, no rendering, no preview.
  The name describes intent, not behaviour.
- **Code** files pick a language. The picker says what each one can do here, and
  the header repeats it:

  - runs here: JavaScript, TypeScript, Python, SQL
  - preview only: HTML, CSS
  - checked here: JSON, YAML (Run parses them and prints the result)
  - external tool: Java, Go, Rust, C++, Bash

Press Run (or Ctrl/Cmd+Enter) to execute. It happens in a sandboxed worker in
your browser; code cannot reach the network, cookies, or your files. Python and
SQL load a runtime on first run.

## Saving

Nothing is saved until you press Save File. While you type, a copy is kept in
this browser so a crash does not lose it; that draft is never sent anywhere on
its own.

Saving asks for a version name. Name it "before the refactor" and history reads
like a changelog. Leave it empty if you do not care.

Save Project (in the editor header) records every changed file in the project at
once, with one message.

## Versions

Every save appends an immutable version. Nothing overwrites history.

- The **versions** button in the file header lists this file's history. Open any
  version to load it into the editor; nothing changes until you save again.
- **Settings → Versions** lists every file and project. Pick a file to compare
  two versions side by side (current against saved, or saved against saved) and
  apply either side. Pick a project to see its named snapshots and apply one.

Applying writes a new revision, so the old state is still there afterwards.

## Notes on anything

Files and projects can carry plain-text notes, separate from the file content.
Open them from the row menu, or with the notes button in the file header. Notes
are for the file's context: what it is, why it exists, what to do next.

## Pins, duplicate, export

- Pin files and folders to keep them at the top of the sidebar. Right-click a
  pin to unpin it.
- Duplicate copies a file or an entire folder subtree next to the original.
  Content is copied; version history is not.
- A project's menu exports the project as a zip of real files. Settings exports
  everything as JSON.

## Trash and limits

Deleted files and folders go to the trash and stay for 30 days. Permanent
deletion is a separate action. Limits: 2 MB per file, 25 MB per account, 2,000
files, 500 folders.

## Settings

Picture and display name save immediately. Username and email changes need a
six-digit code sent to your email; the change only happens once you type it
back. Settings also holds editor preferences (tab size, font size, wrapping,
line numbers), storage usage, the version browser, the shortcut table, the JSON
export, and account deletion.

## Keyboard

- Ctrl/Cmd+K: command palette, jump to any file or folder
- Ctrl/Cmd+S: save, and name the version
- Ctrl/Cmd+Enter: run
- F2: rename the focused row
- Space: tick a row while selecting; Ctrl/Cmd+A selects all
- Delete: move the focused row to the trash
- Arrow keys walk the tree; left and right collapse and expand
- Enter opens a file or expands a folder

## What Nested is not

No sharing, public links, guests, or collaboration. No Markdown rendering. No
image uploads. No git, branches, or remotes. It is a place for the work that
does not belong in a repository, kept private and always recoverable.
$guide$;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         int := 0;
  v_folder  uuid;
begin
  base := lower(coalesce(split_part(new.email, '@', 1), 'user'));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'user';
  end if;
  base := left(base, 28);

  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    n := n + 1;
    candidate := left(base, 28) || '_' || n::text;
  end loop;

  insert into public.profiles (id, email, username)
  values (new.id, new.email, candidate)
  on conflict (id) do nothing;

  if exists (
    select 1 from public.folders f
    where f.owner_id = new.id and f.parent_id is null and f.name = 'getting started'
  ) then
    return new;
  end if;

  insert into public.folders (owner_id, name, sort_order)
  values (new.id, 'getting started', 0)
  returning id into v_folder;

  insert into public.files (owner_id, folder_id, name, kind, language, content)
  values (new.id, v_folder, 'nested.md', 'markdown', null, public.welcome_document());

  return new;
end;
$$;

-- Existing accounts get the same starting project, once.
insert into public.folders (owner_id, name, sort_order)
select p.id, 'getting started', 0
from public.profiles p
where not exists (
  select 1 from public.folders f
  where f.owner_id = p.id and f.parent_id is null and f.name = 'getting started'
    and f.deleted_at is null
);

insert into public.files (owner_id, folder_id, name, kind, language, content)
select f.owner_id, f.id, 'nested.md', 'markdown', null, public.welcome_document()
from public.folders f
where f.name = 'getting started'
  and f.parent_id is null
  and f.deleted_at is null
  and not exists (
    select 1 from public.files x
    where x.owner_id = f.owner_id and x.folder_id = f.id
      and x.name = 'nested.md' and x.deleted_at is null
  );

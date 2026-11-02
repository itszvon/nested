-- Keep admin notes out of the author's reach.
--
-- `suggestions` was granted SELECT table-wide, so the author of a suggestion
-- could read `admin_note` through PostgREST even though the UI never rendered
-- it. Notes now live in their own admin-only table, and the user-facing
-- columns are granted explicitly.

begin;

create table if not exists public.suggestion_notes (
  suggestion_id uuid primary key references public.suggestions (id) on delete cascade,
  note          text not null,
  updated_at    timestamptz not null default now(),
  constraint suggestion_notes_length check (char_length(note) between 1 and 2000)
);

alter table public.suggestion_notes enable row level security;

create policy suggestion_notes_admin on public.suggestion_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.suggestion_notes to authenticated;

-- Move whatever was written so far, then drop the exposed column.
insert into public.suggestion_notes (suggestion_id, note)
select id, admin_note
  from public.suggestions
 where admin_note is not null and btrim(admin_note) <> ''
on conflict (suggestion_id) do nothing;

alter table public.suggestions drop column if exists admin_note;

revoke select on public.suggestions from authenticated;
grant select (id, user_id, title, body, category, status, created_at, updated_at)
  on public.suggestions to authenticated;

commit;

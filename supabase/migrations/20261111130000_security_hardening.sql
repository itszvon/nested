-- Security hardening from the 2026-11-11 audit.
--
-- 1. Codify the profile_change_requests table and its owner-only RLS, which
--    existed only in the hosted project.
-- 2. Codify prune_versions, which existed only in the hosted project.
-- 3. Remove unnecessary trigger-function EXECUTE grants and excessive table
--    grants (TRUNCATE/REFERENCES/TRIGGER) from the exposed roles.
-- 4. Enforce the account storage quota and version size invariants at the
--    database, so direct PostgREST writes cannot bypass save_file.
-- 5. Bound profile settings/display name size.

begin;

-- --------------------------------------------------- profile_change_requests

-- The table already exists in the hosted project. IF NOT EXISTS makes this
-- migration reproducible without touching existing rows.
create table if not exists public.profile_change_requests (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  purpose     text not null check (purpose in ('username', 'email')),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '30 minutes')
);

alter table public.profile_change_requests enable row level security;

drop policy if exists profile_change_requests_select on public.profile_change_requests;
drop policy if exists profile_change_requests_insert on public.profile_change_requests;
drop policy if exists profile_change_requests_delete on public.profile_change_requests;

create policy profile_change_requests_select on public.profile_change_requests
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy profile_change_requests_insert on public.profile_change_requests
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy profile_change_requests_delete on public.profile_change_requests
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create index if not exists profile_change_requests_owner_idx
  on public.profile_change_requests (owner_id, purpose, created_at desc);

revoke all on public.profile_change_requests from anon, authenticated;
grant select, insert, delete on public.profile_change_requests to authenticated;
grant select on public.profile_change_requests to service_role;

-- ------------------------------------------------------------ prune_versions

create or replace function public.prune_versions(p_keep integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  with ranked as (
    select id, label,
           row_number() over (partition by file_id order by created_at desc) as rn
    from public.versions
    where owner_id = auth.uid()
  )
  delete from public.versions v
  using ranked r
  where v.id = r.id
    and v.owner_id = auth.uid()
    and r.label is null
    and r.rn > greatest(0, p_keep);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.prune_versions(integer) from public, anon;
grant execute on function public.prune_versions(integer) to authenticated;

-- ------------------------------------------------ trigger function privileges

-- Trigger functions do not need to be callable through PostgREST. Their
-- triggers continue to run as the table owner.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.files_account() from public, anon, authenticated;
revoke all on function public.versions_account() from public, anon, authenticated;

-- ------------------------------------------------------- version invariants

alter table public.versions
  drop constraint if exists versions_content_size;
alter table public.versions
  add constraint versions_content_size
  check (octet_length(content) <= 2097152);

alter table public.versions
  drop constraint if exists versions_byte_size_nonnegative;
alter table public.versions
  add constraint versions_byte_size_nonnegative
  check (byte_size >= 0);

alter table public.versions
  drop constraint if exists versions_byte_size_matches;
alter table public.versions
  add constraint versions_byte_size_matches
  check (byte_size = octet_length(content));

-- --------------------------------------------------------- profile bounds

alter table public.profiles
  drop constraint if exists profiles_settings_size;
alter table public.profiles
  add constraint profiles_settings_size
  check (pg_column_size(settings) <= 65536);

alter table public.profiles
  drop constraint if exists profiles_display_name_length;
alter table public.profiles
  add constraint profiles_display_name_length
  check (display_name is null or char_length(display_name) <= 60);

alter table public.profiles
  drop constraint if exists profiles_storage_nonnegative;
alter table public.profiles
  add constraint profiles_storage_nonnegative
  check (storage_bytes >= 0);

-- ------------------------------------------------------- quota enforcement

create or replace function public.files_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if tg_op = 'INSERT' then
    select storage_bytes + new.byte_size into v_total
    from public.profiles where id = new.owner_id;

    if coalesce(v_total, 0) > 26214400 then
      raise exception 'quota_exceeded' using errcode = 'P0001';
    end if;

    update public.profiles
    set storage_bytes = storage_bytes + new.byte_size
    where id = new.owner_id;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set storage_bytes = greatest(0, storage_bytes - old.byte_size)
    where id = old.owner_id;
  elsif new.byte_size <> old.byte_size then
    select storage_bytes + new.byte_size - old.byte_size into v_total
    from public.profiles where id = new.owner_id;

    if coalesce(v_total, 0) > 26214400 then
      raise exception 'quota_exceeded' using errcode = 'P0001';
    end if;

    update public.profiles
    set storage_bytes = greatest(0, storage_bytes + new.byte_size - old.byte_size)
    where id = new.owner_id;
  end if;
  return null;
end;
$$;

create or replace function public.versions_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if tg_op = 'INSERT' then
    select storage_bytes + new.byte_size into v_total
    from public.profiles where id = new.owner_id;

    if coalesce(v_total, 0) > 26214400 then
      raise exception 'quota_exceeded' using errcode = 'P0001';
    end if;

    update public.profiles
    set storage_bytes = storage_bytes + new.byte_size
    where id = new.owner_id;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set storage_bytes = greatest(0, storage_bytes - old.byte_size)
    where id = old.owner_id;
  end if;
  return null;
end;
$$;

-- The functions remain trigger-only; re-apply the grants after replacement.
revoke all on function public.files_account() from public, anon, authenticated;
revoke all on function public.versions_account() from public, anon, authenticated;

commit;

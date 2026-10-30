-- Nested: core schema
-- Tables, validation triggers, storage accounting.
-- Policies and RPCs live in the next migration.

begin;

-- ---------------------------------------------------------------- enums

create type public.file_kind as enum ('markdown', 'code');
create type public.file_language as enum ('python', 'java', 'javascript', 'html', 'css', 'cpp');
create type public.version_source as enum ('file', 'project', 'auto');

-- -------------------------------------------------------------- profiles

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  username      text not null,
  storage_bytes bigint not null default 0,
  created_at    timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,32}$')
);

create unique index profiles_username_key on public.profiles (username);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         int := 0;
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

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed in before this migration existed.
insert into public.profiles (id, email, username)
select
  u.id,
  u.email,
  left(
    case
      when char_length(regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g')) >= 3
        then regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g')
      else 'user'
    end,
    27
  ) || '_' || left(replace(u.id::text, '-', ''), 4)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- --------------------------------------------------------------- folders

create table public.folders (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  parent_id     uuid references public.folders (id) on delete cascade,
  name          text not null,
  sort_order    int not null default 0,
  deleted_at    timestamptz,
  trash_root_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint folders_name_length check (char_length(name) between 1 and 255),
  constraint folders_name_no_slash check (position('/' in name) = 0),
  constraint folders_not_own_parent check (parent_id is null or parent_id <> id)
);

create index folders_tree_idx on public.folders (owner_id, parent_id, sort_order)
  where deleted_at is null;

create unique index folders_name_unique on public.folders (
  owner_id,
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
) where deleted_at is null;

create index folders_trash_idx on public.folders (owner_id, deleted_at)
  where deleted_at is not null;

-- Top-level ancestor of a folder, i.e. its project. A root folder is its own project.
create function public.project_of_folder(p_folder uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  with recursive up as (
    select f.id, f.parent_id from public.folders f where f.id = p_folder
    union all
    select f.id, f.parent_id from public.folders f join up on f.id = up.parent_id
  )
  select id from up where parent_id is null
  limit 1;
$$;

create function public.folders_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.folders%rowtype;
begin
  new.name := btrim(new.name);
  if new.name = '' or char_length(new.name) > 255 or position('/' in new.name) > 0 then
    raise exception 'invalid_folder_name';
  end if;

  if new.parent_id is null then
    if tg_op = 'UPDATE' and old.parent_id is not null then
      raise exception 'project_root_cannot_be_nested';
    end if;
  else
    select * into v_parent from public.folders where id = new.parent_id;
    if not found then
      raise exception 'parent_not_found';
    end if;
    if v_parent.owner_id <> new.owner_id then
      raise exception 'parent_not_owned';
    end if;
    -- Only new placements are checked. Restoring a subtree walks through rows
    -- whose parents are still marked deleted, and that is legitimate.
    if v_parent.deleted_at is not null
       and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
      raise exception 'parent_trashed';
    end if;

    if tg_op = 'UPDATE' and new.parent_id <> old.parent_id then
      if exists (
        with recursive up as (
          select f.id, f.parent_id from public.folders f where f.id = new.parent_id
          union all
          select f.id, f.parent_id from public.folders f join up on f.id = up.parent_id
        )
        select 1 from up where id = new.id
      ) then
        raise exception 'folder_cycle';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT'
     and (select count(*) from public.folders f
          where f.owner_id = new.owner_id and f.deleted_at is null) >= 500 then
    raise exception 'folder_limit_reached';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger folders_validate
  before insert or update on public.folders
  for each row execute function public.folders_validate();

-- Moving a folder changes the project of every file beneath it.
create function public.folders_refresh_projects()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is distinct from old.parent_id then
    with recursive sub as (
      select f.id from public.folders f where f.id = new.id
      union all
      select f.id from public.folders f join sub on f.parent_id = sub.id
    )
    update public.files
       set project_id = public.project_of_folder(new.id)
     where folder_id in (select id from sub);
  end if;
  return null;
end;
$$;

create trigger folders_refresh_projects
  after update of parent_id on public.folders
  for each row execute function public.folders_refresh_projects();

-- ---------------------------------------------------------------- files

create table public.files (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  folder_id    uuid references public.folders (id) on delete cascade,
  project_id   uuid references public.folders (id) on delete cascade,
  name         text not null,
  kind         public.file_kind not null,
  language     public.file_language,
  content      text not null default '',
  content_hash text,
  byte_size    int not null default 0,
  revision     int not null default 1,
  deleted_at   timestamptz,
  trash_root_id uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint files_name_length check (char_length(name) between 1 and 255),
  constraint files_name_no_slash check (position('/' in name) = 0),
  constraint files_size_cap check (byte_size <= 2097152),
  constraint files_language_matches_kind check (
    (kind = 'code' and language is not null) or
    (kind = 'markdown' and language is null)
  ),
  constraint files_project_matches_folder check (
    (folder_id is null and project_id is null) or
    (folder_id is not null and project_id is not null)
  )
);

create index files_tree_idx on public.files (owner_id, folder_id)
  where deleted_at is null;

create index files_project_idx on public.files (owner_id, project_id)
  where deleted_at is null;

create index files_trash_idx on public.files (owner_id, deleted_at)
  where deleted_at is not null;

create unique index files_name_unique on public.files (
  owner_id,
  coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
) where deleted_at is null;

create function public.files_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_folder public.folders%rowtype;
begin
  new.name := btrim(new.name);
  if new.name = '' or char_length(new.name) > 255 or position('/' in new.name) > 0 then
    raise exception 'invalid_file_name';
  end if;

  if new.kind = 'code' and new.language is null then
    raise exception 'language_required';
  end if;
  if new.kind = 'markdown' and new.language is not null then
    raise exception 'language_not_allowed';
  end if;

  new.byte_size := octet_length(new.content);
  new.content_hash := encode(sha256(convert_to(new.content, 'UTF8')), 'hex');

  if new.byte_size > 2097152 then
    raise exception 'file_too_large';
  end if;

  if new.folder_id is null then
    new.project_id := null;
  else
    select * into v_folder from public.folders where id = new.folder_id;
    if not found then
      raise exception 'parent_not_found';
    end if;
    if v_folder.owner_id <> new.owner_id then
      raise exception 'parent_not_owned';
    end if;
    if v_folder.deleted_at is not null
       and (tg_op = 'INSERT' or new.folder_id is distinct from old.folder_id) then
      raise exception 'parent_trashed';
    end if;
    new.project_id := public.project_of_folder(new.folder_id);
  end if;

  if tg_op = 'INSERT'
     and (select count(*) from public.files f
          where f.owner_id = new.owner_id and f.deleted_at is null) >= 2000 then
    raise exception 'file_limit_reached';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger files_validate
  before insert or update on public.files
  for each row execute function public.files_validate();

-- ------------------------------------------------------------- snapshots

create table public.snapshots (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  project_id  uuid not null references public.folders (id) on delete cascade,
  message     text,
  file_count  int not null default 0,
  total_bytes int not null default 0,
  created_at  timestamptz not null default now(),
  constraint snapshots_message_length check (message is null or char_length(message) <= 200)
);

create index snapshots_project_idx on public.snapshots (owner_id, project_id, created_at desc);

-- -------------------------------------------------------------- versions

create table public.versions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  file_id         uuid not null references public.files (id) on delete cascade,
  source          public.version_source not null,
  snapshot_id     uuid references public.snapshots (id) on delete set null,
  label           text,
  content         text not null,
  content_hash    text not null,
  byte_size       int not null,
  source_revision int not null,
  created_at      timestamptz not null default clock_timestamp()
);

create index versions_file_idx on public.versions (file_id, created_at desc);
create index versions_snapshot_idx on public.versions (snapshot_id);

-- ---------------------------------------------------- storage accounting

create function public.files_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set storage_bytes = storage_bytes + new.byte_size where id = new.owner_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set storage_bytes = greatest(0, storage_bytes - old.byte_size) where id = old.owner_id;
  elsif new.byte_size <> old.byte_size then
    update public.profiles set storage_bytes = greatest(0, storage_bytes + new.byte_size - old.byte_size) where id = new.owner_id;
  end if;
  return null;
end;
$$;

create trigger files_account
  after insert or delete or update on public.files
  for each row execute function public.files_account();

create function public.versions_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set storage_bytes = storage_bytes + new.byte_size where id = new.owner_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set storage_bytes = greatest(0, storage_bytes - old.byte_size) where id = old.owner_id;
  end if;
  return null;
end;
$$;

create trigger versions_account
  after insert or delete on public.versions
  for each row execute function public.versions_account();

commit;

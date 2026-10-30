-- Nested: row level security, grants, and the multi-step operations.
-- Single-row checks live in triggers; only operations that must be atomic
-- live here.

begin;

-- ------------------------------------------------------------------- RLS

alter table public.profiles  enable row level security;
alter table public.folders   enable row level security;
alter table public.files     enable row level security;
alter table public.snapshots enable row level security;
alter table public.versions  enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy folders_select on public.folders
  for select to authenticated using (owner_id = (select auth.uid()));
create policy folders_insert on public.folders
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy folders_update on public.folders
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy folders_delete on public.folders
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy files_select on public.files
  for select to authenticated using (owner_id = (select auth.uid()));
create policy files_insert on public.files
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy files_update on public.files
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy files_delete on public.files
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy snapshots_select on public.snapshots
  for select to authenticated using (owner_id = (select auth.uid()));
create policy snapshots_insert on public.snapshots
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy snapshots_update on public.snapshots
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy snapshots_delete on public.snapshots
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy versions_select on public.versions
  for select to authenticated using (owner_id = (select auth.uid()));
create policy versions_insert on public.versions
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.files f
      where f.id = versions.file_id and f.owner_id = (select auth.uid())
    )
  );
create policy versions_delete on public.versions
  for delete to authenticated using (owner_id = (select auth.uid()));
-- No update policy: versions are immutable.

-- ---------------------------------------------------------------- grants

grant usage on schema public to authenticated, service_role;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.files to authenticated;
grant select, insert, update, delete on public.snapshots to authenticated;
grant select, insert, delete on public.versions to authenticated;

-- ------------------------------------------------------------ save_file

create function public.save_file(
  p_file_id uuid,
  p_content text,
  p_expected_revision int
)
returns table (revision int, version_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_file       public.files%rowtype;
  v_profile    public.profiles%rowtype;
  v_size       int;
  v_delta      bigint;
  v_last_hash  text;
  v_version_id uuid;
begin
  select * into v_file
  from public.files
  where id = p_file_id and owner_id = auth.uid() and deleted_at is null;

  if not found then
    raise exception 'file_not_found' using errcode = 'P0002';
  end if;

  if v_file.revision <> p_expected_revision then
    raise exception 'revision_conflict:%', v_file.revision using errcode = 'P0001';
  end if;

  v_size := octet_length(p_content);
  if v_size > 2097152 then
    raise exception 'file_too_large' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  v_delta := v_size - v_file.byte_size;

  if v_profile.storage_bytes + v_delta > 26214400 then
    raise exception 'quota_exceeded:%', v_profile.storage_bytes using errcode = 'P0001';
  end if;

  update public.files
  set content = p_content,
      revision = public.files.revision + 1
  where id = p_file_id
  returning * into v_file;

  select content_hash into v_last_hash
  from public.versions
  where file_id = p_file_id
  order by created_at desc
  limit 1;

  if v_last_hash is distinct from v_file.content_hash then
    insert into public.versions
      (owner_id, file_id, source, content, content_hash, byte_size, source_revision)
    values
      (v_file.owner_id, p_file_id, 'file', p_content, v_file.content_hash, v_file.byte_size, v_file.revision)
    returning id into v_version_id;
  end if;

  return query select v_file.revision, v_version_id;
end;
$$;

-- --------------------------------------------------------- save_project

create function public.save_project(
  p_project_id uuid,
  p_message text,
  p_items jsonb
)
returns table (snapshot_id uuid, saved int, skipped int)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item      jsonb;
  v_file      public.files%rowtype;
  v_profile   public.profiles%rowtype;
  v_size      int;
  v_delta     bigint := 0;
  v_snapshot  uuid;
  v_saved     int := 0;
  v_skipped   int := 0;
  v_label     text;
  v_last_hash text;
begin
  if not exists (
    select 1 from public.folders
    where id = p_project_id and owner_id = auth.uid()
      and parent_id is null and deleted_at is null
  ) then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_items' using errcode = 'P0001';
  end if;

  -- Validate everything before writing anything.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_file
    from public.files
    where id = (v_item ->> 'file_id')::uuid
      and owner_id = auth.uid() and deleted_at is null;

    if not found then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;
    if v_file.project_id is distinct from p_project_id then
      raise exception 'file_not_in_project:%', v_file.id using errcode = 'P0001';
    end if;
    if v_file.revision <> (v_item ->> 'expected_revision')::int then
      raise exception 'revision_conflict:%:%', v_file.id, v_file.revision using errcode = 'P0001';
    end if;

    v_size := octet_length(v_item ->> 'content');
    if v_size > 2097152 then
      raise exception 'file_too_large:%', v_file.id using errcode = 'P0001';
    end if;

    v_delta := v_delta + v_size - v_file.byte_size;
  end loop;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.storage_bytes + v_delta > 26214400 then
    raise exception 'quota_exceeded:%', v_profile.storage_bytes using errcode = 'P0001';
  end if;

  v_label := nullif(btrim(coalesce(p_message, '')), '');

  insert into public.snapshots (owner_id, project_id, message)
  values (auth.uid(), p_project_id, v_label)
  returning id into v_snapshot;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update public.files
    set content = v_item ->> 'content', revision = revision + 1
    where id = (v_item ->> 'file_id')::uuid
    returning * into v_file;

    select content_hash into v_last_hash
    from public.versions
    where file_id = v_file.id
    order by created_at desc
    limit 1;

    if v_last_hash is distinct from v_file.content_hash then
      insert into public.versions
        (owner_id, file_id, source, snapshot_id, label, content, content_hash, byte_size, source_revision)
      values
        (v_file.owner_id, v_file.id, 'project', v_snapshot, v_label, v_file.content, v_file.content_hash, v_file.byte_size, v_file.revision);
      v_saved := v_saved + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  update public.snapshots
  set file_count = v_saved,
      total_bytes = coalesce((select sum(byte_size) from public.versions where snapshot_id = v_snapshot), 0)
  where id = v_snapshot;

  return query select v_snapshot, v_saved, v_skipped;
end;
$$;

-- ------------------------------------------------------ restore_version

-- Returns the content to load into the buffer. It does not write to the file:
-- restoring leaves the file dirty until Save File, per the spec.
create function public.restore_version(p_version_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version   public.versions%rowtype;
  v_file      public.files%rowtype;
  v_last_hash text;
begin
  select * into v_version
  from public.versions
  where id = p_version_id and owner_id = auth.uid();

  if not found then
    raise exception 'version_not_found' using errcode = 'P0002';
  end if;

  select * into v_file
  from public.files
  where id = v_version.file_id and owner_id = auth.uid() and deleted_at is null;

  if not found then
    raise exception 'file_not_found' using errcode = 'P0002';
  end if;

  if v_file.content_hash is distinct from v_version.content_hash then
    select content_hash into v_last_hash
    from public.versions
    where file_id = v_file.id
    order by created_at desc
    limit 1;

    if v_last_hash is distinct from v_file.content_hash then
      insert into public.versions
        (owner_id, file_id, source, label, content, content_hash, byte_size, source_revision)
      values
        (v_file.owner_id, v_file.id, 'auto',
         'Before restore of ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS'),
         v_file.content, v_file.content_hash, v_file.byte_size, v_file.revision);
    end if;
  end if;

  return v_version.content;
end;
$$;

-- ---------------------------------------------------------- trash_node

create function public.trash_node(p_kind text, p_id uuid)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids   uuid[];
  v_count int;
begin
  if p_kind = 'file' then
    update public.files
    set deleted_at = now(), trash_root_id = p_id
    where id = p_id and owner_id = auth.uid() and deleted_at is null;

    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;
    return v_count;
  end if;

  if p_kind <> 'folder' then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.folders
    where id = p_id and owner_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  with recursive sub as (
    select f.id from public.folders f where f.id = p_id
    union all
    select f.id from public.folders f join sub on f.parent_id = sub.id
  )
  select array_agg(id) into v_ids from sub;

  update public.folders
  set deleted_at = now(), trash_root_id = p_id
  where id = any(v_ids) and deleted_at is null;

  update public.files
  set deleted_at = now(), trash_root_id = p_id
  where folder_id = any(v_ids) and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -------------------------------------------------------- restore_node

create function public.restore_node(p_kind text, p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_folder public.folders%rowtype;
  v_parent uuid;
  v_name   text;
begin
  if p_kind = 'file' then
    if not exists (
      select 1 from public.files
      where id = p_id and owner_id = auth.uid() and deleted_at is not null
    ) then
      raise exception 'not_in_trash' using errcode = 'P0002';
    end if;

    update public.files
    set deleted_at = null, trash_root_id = null
    where id = p_id and owner_id = auth.uid();

    update public.files set project_id = public.project_of_folder(folder_id)
    where id = p_id and folder_id is not null;
    return;
  end if;

  if p_kind <> 'folder' then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;

  select * into v_folder
  from public.folders
  where id = p_id and owner_id = auth.uid() and deleted_at is not null;

  if not found then
    raise exception 'not_in_trash' using errcode = 'P0002';
  end if;

  -- Original parent if it still exists and is live, otherwise root.
  v_parent := v_folder.parent_id;
  if v_parent is not null and not exists (
    select 1 from public.folders where id = v_parent and deleted_at is null
  ) then
    v_parent := null;
  end if;

  v_name := v_folder.name;
  if exists (
    select 1 from public.folders
    where owner_id = auth.uid() and deleted_at is null and id <> p_id
      and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(v_parent, '00000000-0000-0000-0000-000000000000'::uuid)
      and lower(name) = lower(v_name)
  ) then
    v_name := left(v_name, 245) || ' (restored)';
  end if;

  update public.folders
  set deleted_at = null, trash_root_id = null, parent_id = v_parent, name = v_name
  where id = p_id;

  update public.folders
  set deleted_at = null, trash_root_id = null
  where trash_root_id = p_id and id <> p_id;

  update public.files
  set deleted_at = null, trash_root_id = null
  where trash_root_id = p_id;

  with recursive sub as (
    select f.id from public.folders f where f.id = p_id
    union all
    select f.id from public.folders f join sub on f.parent_id = sub.id
  )
  update public.files
  set project_id = public.project_of_folder(files.folder_id)
  where folder_id in (select id from sub);
end;
$$;

-- ----------------------------------------------------------- purge_trash

-- Deletes trash older than p_days. Called by cron with the service role, so it
-- spans users there and is limited to the caller's rows under RLS.
create function public.purge_trash(p_days int default 30)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_n     int;
begin
  delete from public.folders
  where deleted_at is not null and trash_root_id = id
    and deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  delete from public.files
  where deleted_at is not null and trash_root_id = id
    and deleted_at < now() - make_interval(days => p_days);
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  return v_count;
end;
$$;

create function public.empty_trash()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  v_n     int;
begin
  delete from public.folders
  where owner_id = auth.uid() and deleted_at is not null and trash_root_id = id;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  delete from public.files
  where owner_id = auth.uid() and deleted_at is not null and trash_root_id = id;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  return v_count;
end;
$$;

-- ------------------------------------------------------------- move_node

create function public.move_node(
  p_kind text,
  p_id uuid,
  p_new_parent uuid,
  p_new_sort int default 0
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_kind = 'folder' then
    update public.folders
    set parent_id = p_new_parent, sort_order = p_new_sort
    where id = p_id and owner_id = auth.uid() and deleted_at is null;
  elsif p_kind = 'file' then
    update public.files
    set folder_id = p_new_parent, project_id = case
          when p_new_parent is null then null
          else public.project_of_folder(p_new_parent)
        end
    where id = p_id and owner_id = auth.uid() and deleted_at is null;
  else
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;

  if not found then
    raise exception 'node_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ------------------------------------------------------------- privileges

revoke execute on function public.save_file(uuid, text, int) from public, anon;
revoke execute on function public.save_project(uuid, text, jsonb) from public, anon;
revoke execute on function public.restore_version(uuid) from public, anon;
revoke execute on function public.trash_node(text, uuid) from public, anon;
revoke execute on function public.restore_node(text, uuid) from public, anon;
revoke execute on function public.empty_trash() from public, anon;
revoke execute on function public.purge_trash(int) from public, anon, authenticated;
revoke execute on function public.move_node(text, uuid, uuid, int) from public, anon;

grant execute on function public.save_file(uuid, text, int) to authenticated;
grant execute on function public.save_project(uuid, text, jsonb) to authenticated;
grant execute on function public.restore_version(uuid) to authenticated;
grant execute on function public.trash_node(text, uuid) to authenticated;
grant execute on function public.restore_node(text, uuid) to authenticated;
grant execute on function public.empty_trash() to authenticated;
grant execute on function public.move_node(text, uuid, uuid, int) to authenticated;

commit;

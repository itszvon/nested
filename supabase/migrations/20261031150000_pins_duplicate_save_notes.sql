-- Pins, duplication, and save notes.
--
-- Pins are a timestamp rather than a flag so the newest pin sorts first and
-- unpinning is a single null write.
alter table public.files add column if not exists pinned_at timestamptz;
alter table public.folders add column if not exists pinned_at timestamptz;

create index if not exists files_pinned_idx
  on public.files (owner_id, pinned_at desc)
  where pinned_at is not null and deleted_at is null;

create index if not exists folders_pinned_idx
  on public.folders (owner_id, pinned_at desc)
  where pinned_at is not null and deleted_at is null;

-- ------------------------------------------------------------- save_file
-- Gains an optional note that is stored on the version. The old signature is
-- dropped first: with a defaulted fourth argument both forms would exist and
-- a three-argument call would be ambiguous.

drop function if exists public.save_file(uuid, text, int);

create function public.save_file(
  p_file_id uuid,
  p_content text,
  p_expected_revision int,
  p_label text default null
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
  v_label      text;
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

  v_label := nullif(btrim(coalesce(p_label, '')), '');
  if v_label is not null then
    v_label := left(v_label, 200);
  end if;

  if v_last_hash is distinct from v_file.content_hash then
    insert into public.versions
      (owner_id, file_id, source, label, content, content_hash, byte_size, source_revision)
    values
      (v_file.owner_id, p_file_id, 'file', v_label, p_content, v_file.content_hash, v_file.byte_size, v_file.revision)
    returning id into v_version_id;
  end if;

  return query select v_file.revision, v_version_id;
end;
$$;

revoke execute on function public.save_file(uuid, text, int, text) from public, anon;
grant execute on function public.save_file(uuid, text, int, text) to authenticated;

-- ------------------------------------------------------------- duplicate

-- "name (copy)", then "name (copy 2)", and so on, checked against live
-- siblings so it can never collide with the unique index.
create or replace function public.unique_copy_name(
  p_owner uuid,
  p_parent uuid,
  p_name text,
  p_is_folder boolean
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_base      text := regexp_replace(p_name, ' \(copy( [0-9]+)?\)$', '');
  v_candidate text := v_base || ' (copy)';
  v_i         int := 2;
  v_taken     boolean;
begin
  loop
    if p_is_folder then
      select exists (
        select 1 from public.folders
        where owner_id = p_owner
          and deleted_at is null
          and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(p_parent, '00000000-0000-0000-0000-000000000000'::uuid)
          and lower(name) = lower(v_candidate)
      ) into v_taken;
    else
      select exists (
        select 1 from public.files
        where owner_id = p_owner
          and deleted_at is null
          and coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(p_parent, '00000000-0000-0000-0000-000000000000'::uuid)
          and lower(name) = lower(v_candidate)
      ) into v_taken;
    end if;

    exit when not v_taken;
    v_candidate := v_base || ' (copy ' || v_i || ')';
    v_i := v_i + 1;
  end loop;

  return v_candidate;
end;
$$;

/**
 * Copies a file or a folder subtree next to the original.
 *
 * Content is copied, version history is not: duplicating a project should not
 * double its storage footprint with every save it ever had. Triggers recompute
 * hashes, sizes, and project ids on the way in.
 */
create or replace function public.duplicate_node(p_kind text, p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner   uuid := auth.uid();
  v_folder  public.folders%rowtype;
  v_file    public.files%rowtype;
  v_root    uuid;
  v_new     uuid;
  v_name    text;
  v_old     uuid;
  v_parent  uuid;
  v_map     jsonb := '{}'::jsonb;
  v_bytes   bigint;
  v_storage bigint;
begin
  if v_owner is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind = 'file' then
    select * into v_file
    from public.files
    where id = p_id and owner_id = v_owner and deleted_at is null;

    if not found then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;

    select storage_bytes into v_storage from public.profiles where id = v_owner;
    if v_storage + v_file.byte_size > 26214400 then
      raise exception 'quota_exceeded:%', v_storage using errcode = 'P0001';
    end if;

    v_name := public.unique_copy_name(v_owner, v_file.folder_id, v_file.name, false);

    insert into public.files (owner_id, folder_id, name, kind, language, content)
    values (v_owner, v_file.folder_id, v_name, v_file.kind, v_file.language, v_file.content)
    returning id into v_root;

    return v_root;
  end if;

  if p_kind <> 'folder' then
    raise exception 'invalid_kind';
  end if;

  select * into v_folder
  from public.folders
  where id = p_id and owner_id = v_owner and deleted_at is null;

  if not found then
    raise exception 'folder_not_found' using errcode = 'P0002';
  end if;

  with recursive tree as (
    select f.id from public.folders f
    where f.id = p_id
    union all
    select f.id from public.folders f
    join tree t on f.parent_id = t.id
    where f.deleted_at is null
  )
  select coalesce(sum(f.byte_size), 0) into v_bytes
  from public.files f
  join tree t on f.folder_id = t.id
  where f.owner_id = v_owner and f.deleted_at is null;

  select storage_bytes into v_storage from public.profiles where id = v_owner;
  if v_storage + v_bytes > 26214400 then
    raise exception 'quota_exceeded:%', v_storage using errcode = 'P0001';
  end if;

  v_name := public.unique_copy_name(v_owner, v_folder.parent_id, v_folder.name, true);

  insert into public.folders (owner_id, parent_id, name, sort_order)
  values (v_owner, v_folder.parent_id, v_name, v_folder.sort_order)
  returning id into v_root;

  v_map := jsonb_build_object(v_folder.id::text, v_root::text);

  -- Parents before children: every copied folder looks up its new parent id.
  for v_old, v_parent in
    with recursive tree as (
      select f.id, f.parent_id, 1 as depth
      from public.folders f
      where f.parent_id = p_id and f.deleted_at is null
      union all
      select f.id, f.parent_id, t.depth + 1
      from public.folders f
      join tree t on f.parent_id = t.id
      where f.deleted_at is null
    )
    select id, parent_id from tree order by depth, id
  loop
    insert into public.folders (owner_id, parent_id, name, sort_order)
    select v_owner, (v_map ->> v_parent::text)::uuid, f.name, f.sort_order
    from public.folders f where f.id = v_old
    returning id into v_new;

    v_map := v_map || jsonb_build_object(v_old::text, v_new::text);
  end loop;

  insert into public.files (owner_id, folder_id, name, kind, language, content)
  select v_owner,
         (v_map ->> f.folder_id::text)::uuid,
         f.name,
         f.kind,
         f.language,
         f.content
  from public.files f
  where f.owner_id = v_owner
    and f.deleted_at is null
    and f.folder_id in (select (key)::uuid from jsonb_each(v_map));

  return v_root;
end;
$$;

revoke execute on function public.duplicate_node(text, uuid) from public, anon;
grant execute on function public.duplicate_node(text, uuid) to authenticated;
revoke execute on function public.unique_copy_name(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.unique_copy_name(uuid, uuid, text, boolean) to authenticated;

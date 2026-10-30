-- save_project's OUT parameter `snapshot_id` collides with the column of the
-- same name in the aggregate subquery, so the reference is qualified.

begin;

create or replace function public.save_project(
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
    set content = v_item ->> 'content',
        revision = public.files.revision + 1
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

  update public.snapshots s
  set file_count = v_saved,
      total_bytes = coalesce(
        (select sum(v.byte_size) from public.versions v where v.snapshot_id = v_snapshot),
        0
      )
  where s.id = v_snapshot;

  return query select v_snapshot, v_saved, v_skipped;
end;
$$;

commit;

-- Whole-project restore.
--
-- Puts every file back to the state captured by one Save Project. Each changed
-- file first gets an automatic version of what it holds now, so a restore is
-- itself undoable per file.

begin;

create or replace function public.restore_project(p_snapshot_id uuid)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_snapshot public.snapshots%rowtype;
  v_version  public.versions%rowtype;
  v_file     public.files%rowtype;
  v_changed  int := 0;
begin
  select * into v_snapshot
  from public.snapshots
  where id = p_snapshot_id and owner_id = auth.uid();

  if not found then
    raise exception 'snapshot_not_found' using errcode = 'P0002';
  end if;

  for v_version in
    select * from public.versions where snapshot_id = p_snapshot_id
  loop
    select * into v_file
    from public.files
    where id = v_version.file_id and owner_id = auth.uid() and deleted_at is null;

    -- Files deleted or trashed since the snapshot are left alone.
    if not found then
      continue;
    end if;

    if v_file.content_hash is not distinct from v_version.content_hash then
      continue;
    end if;

    insert into public.versions
      (owner_id, file_id, source, label, content, content_hash, byte_size, source_revision)
    values
      (v_file.owner_id, v_file.id, 'auto',
       'Before project restore of ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI'),
       v_file.content, v_file.content_hash, v_file.byte_size, v_file.revision);

    update public.files
    set content = v_version.content,
        revision = public.files.revision + 1
    where id = v_file.id;

    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke execute on function public.restore_project(uuid) from public, anon;
grant execute on function public.restore_project(uuid) to authenticated;

commit;

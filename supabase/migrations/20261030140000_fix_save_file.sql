-- save_file declared OUT parameters named `revision` and `version_id`, which
-- collide with the columns of the same name. Qualifying the assignment target
-- with the table name resolves the ambiguity.

begin;

create or replace function public.save_file(
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

commit;

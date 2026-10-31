-- File copies must keep their extension at the end. "script.py (copy)" was
-- rejected by the extension check; "script (copy).py" is a real Python file.

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
  v_stem      text;
  v_ext       text := '';
  v_base      text;
  v_candidate text;
  v_i         int := 2;
  v_taken     boolean;
begin
  if p_is_folder then
    v_stem := p_name;
  else
    -- Only split a dot that is not the first character, so ".env" stays whole.
    if position('.' in p_name) > 1 then
      v_ext := substring(p_name from '\.[^.]*$');
      v_stem := left(p_name, length(p_name) - length(v_ext));
    else
      v_stem := p_name;
    end if;
  end if;

  v_base := regexp_replace(v_stem, ' \(copy( [0-9]+)?\)$', '');
  v_candidate := v_base || ' (copy)' || v_ext;

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
    v_candidate := v_base || ' (copy ' || v_i || ')' || v_ext;
    v_i := v_i + 1;
  end loop;

  return v_candidate;
end;
$$;

revoke execute on function public.unique_copy_name(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.unique_copy_name(uuid, uuid, text, boolean) to authenticated;

-- Plain-text notes attached to any file or project.
alter table public.files add column if not exists notes text not null default '';
alter table public.folders add column if not exists notes text not null default '';

alter table public.files drop constraint if exists files_notes_length;
alter table public.files add constraint files_notes_length check (char_length(notes) <= 100000);

alter table public.folders drop constraint if exists folders_notes_length;
alter table public.folders add constraint folders_notes_length check (char_length(notes) <= 100000);

-- Code files must carry a real extension, and the extension decides the
-- language. Renaming first.py to "first" leaves a code file that no editor can
-- identify, so the database refuses it instead of trusting the dialog.

begin;

create or replace function public.files_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_folder public.folders%rowtype;
  v_ext    text;
  v_lang   public.file_language;
begin
  new.name := btrim(new.name);
  if new.name = '' or char_length(new.name) > 255 or position('/' in new.name) > 0 then
    raise exception 'invalid_file_name';
  end if;

  if new.kind = 'markdown' then
    -- Text files are not required to carry an extension.
    new.language := null;
  else
    v_ext := lower(substring(new.name from '\.([^.]+)$'));

    if v_ext is null then
      raise exception 'extension_required' using errcode = 'P0001';
    end if;

    v_lang := case v_ext
      when 'py'   then 'python'::public.file_language
      when 'java' then 'java'::public.file_language
      when 'js'   then 'javascript'::public.file_language
      when 'html' then 'html'::public.file_language
      when 'css'  then 'css'::public.file_language
      when 'cpp'  then 'cpp'::public.file_language
      when 'h'    then 'cpp'::public.file_language
      when 'hpp'  then 'cpp'::public.file_language
      else null
    end;

    if v_lang is null then
      raise exception 'invalid_extension:%', v_ext using errcode = 'P0001';
    end if;

    new.language := v_lang;
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

-- Repair code files that lost their extension before this rule existed.
update public.files f
set name = rtrim(f.name, '.') || '.' ||
  case f.language
    when 'python'     then 'py'
    when 'java'       then 'java'
    when 'javascript' then 'js'
    when 'html'       then 'html'
    when 'css'        then 'css'
    when 'cpp'        then 'cpp'
  end
where f.kind = 'code'
  and f.name !~* '\.(py|java|js|html|css|cpp|h|hpp)$';

commit;

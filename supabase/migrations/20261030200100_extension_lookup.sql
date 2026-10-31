-- Extension to language becomes data, not a CASE statement.
--
-- Adding a language used to mean rewriting the validation function. Now it is
-- one insert here, which is what keeps the next batch cheap.

begin;

create table public.file_extensions (
  extension text primary key,
  language  public.file_language not null
);

alter table public.file_extensions enable row level security;

create policy file_extensions_select on public.file_extensions
  for select to authenticated using (true);

grant select on public.file_extensions to authenticated;

insert into public.file_extensions (extension, language) values
  ('py',   'python'),
  ('java', 'java'),
  ('js',   'javascript'),
  ('mjs',  'javascript'),
  ('cjs',  'javascript'),
  ('ts',   'typescript'),
  ('tsx',  'typescript'),
  ('html', 'html'),
  ('htm',  'html'),
  ('css',  'css'),
  ('cpp',  'cpp'),
  ('cxx',  'cpp'),
  ('cc',   'cpp'),
  ('h',    'cpp'),
  ('hpp',  'cpp'),
  ('go',   'go'),
  ('rs',   'rust'),
  ('sql',  'sql'),
  ('sh',   'bash'),
  ('bash', 'bash'),
  ('zsh',  'bash');

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

    select e.language into v_lang
    from public.file_extensions e
    where e.extension = v_ext;

    if not found then
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

commit;

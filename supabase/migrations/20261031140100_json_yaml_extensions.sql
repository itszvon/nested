-- The extension table already exists so registering them needs no function
-- change. .yml is the other common spelling of YAML.
insert into public.file_extensions (extension, language) values
  ('json', 'json'),
  ('yaml', 'yaml'),
  ('yml', 'yaml')
on conflict (extension) do update set language = excluded.language;

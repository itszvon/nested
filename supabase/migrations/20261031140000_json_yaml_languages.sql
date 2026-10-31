-- JSON and YAML are parsed in the browser, so they belong in the language
-- enum like any other. Values go in their own migration because Postgres will
-- not use a new enum value in the transaction that adds it.
alter type public.file_language add value if not exists 'json';
alter type public.file_language add value if not exists 'yaml';

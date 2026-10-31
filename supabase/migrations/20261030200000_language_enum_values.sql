-- New languages, batch one.
--
-- Postgres refuses to use a freshly added enum value in the same transaction,
-- so this migration only adds them. The lookup table and the updated validator
-- are in the next one.

begin;

alter type public.file_language add value if not exists 'typescript';
alter type public.file_language add value if not exists 'go';
alter type public.file_language add value if not exists 'rust';
alter type public.file_language add value if not exists 'sql';
alter type public.file_language add value if not exists 'bash';

commit;

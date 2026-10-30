-- `UPDATE OF byte_size` only fires when byte_size appears in the SET clause.
-- save_file writes `content`, and byte_size is recomputed by the BEFORE
-- trigger afterwards, so the accounting never ran and every edit silently
-- under-counted storage. Fire on all updates; the function already ignores
-- no-op changes.

begin;

drop trigger if exists files_account on public.files;

create trigger files_account
  after insert or delete or update on public.files
  for each row execute function public.files_account();

commit;

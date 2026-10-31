-- Ordering.
--
-- Files never had a sort_order, so nothing could be reordered inside a folder.
-- Reordering is expressed as an explicit list of sibling ids rather than a
-- midpoint, because integer midpoints run out of room after a few drops.

begin;

alter table public.files
  add column if not exists sort_order int not null default 0;

create index if not exists files_sort_idx on public.files (folder_id, sort_order)
  where deleted_at is null;

create or replace function public.reorder_nodes(
  p_kind text,
  p_parent uuid,
  p_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  i int;
begin
  if p_kind = 'folder' then
    for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
      update public.folders
      set sort_order = i
      where id = p_ids[i]
        and owner_id = auth.uid()
        and parent_id is not distinct from p_parent;
    end loop;
  elsif p_kind = 'file' then
    for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
      update public.files
      set sort_order = i
      where id = p_ids[i]
        and owner_id = auth.uid()
        and folder_id is not distinct from p_parent;
    end loop;
  else
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.reorder_nodes(text, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_nodes(text, uuid, uuid[]) to authenticated;

commit;

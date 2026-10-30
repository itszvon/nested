-- Fixes for the folder guards.
--
-- 1. `new.parent_id <> old.parent_id` is NULL when the old value is NULL, so
--    the cycle check silently skipped exactly the case that creates a loop
--    (moving a project root under its own child). Use IS DISTINCT FROM.
-- 2. The project-root guard was inverted: it blocked un-nesting instead of
--    nesting. Roots may be moved out to the top level, never into a folder.
-- 3. project_of_folder now has a depth cap, so a corrupted tree degrades into
--    a null project instead of spinning until the server runs out of temp space.

begin;

create or replace function public.project_of_folder(p_folder uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  with recursive up as (
    select f.id, f.parent_id, 0 as depth
    from public.folders f
    where f.id = p_folder
    union all
    select f.id, f.parent_id, up.depth + 1
    from public.folders f
    join up on f.id = up.parent_id
    where up.depth < 100
  )
  select id from up where parent_id is null
  limit 1;
$$;

create or replace function public.folders_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.folders%rowtype;
begin
  new.name := btrim(new.name);
  if new.name = '' or char_length(new.name) > 255 or position('/' in new.name) > 0 then
    raise exception 'invalid_folder_name';
  end if;

  -- A project root stays at the top. Moving it into a folder would silently
  -- merge two projects, so it is refused rather than reinterpreted.
  if tg_op = 'UPDATE' and old.parent_id is null and new.parent_id is not null then
    raise exception 'project_root_cannot_be_nested';
  end if;

  if new.parent_id is not null then
    select * into v_parent from public.folders where id = new.parent_id;
    if not found then
      raise exception 'parent_not_found';
    end if;
    if v_parent.owner_id <> new.owner_id then
      raise exception 'parent_not_owned';
    end if;

    -- Only new placements are checked. Restoring a subtree walks through rows
    -- whose parents are still marked deleted, and that is legitimate.
    if v_parent.deleted_at is not null
       and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
      raise exception 'parent_trashed';
    end if;

    if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
      if exists (
        with recursive up as (
          select f.id, f.parent_id from public.folders f where f.id = new.parent_id
          union all
          select f.id, f.parent_id from public.folders f join up on f.id = up.parent_id
        )
        select 1 from up where id = new.id
      ) then
        raise exception 'folder_cycle';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT'
     and (select count(*) from public.folders f
          where f.owner_id = new.owner_id and f.deleted_at is null) >= 500 then
    raise exception 'folder_limit_reached';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.folders_refresh_projects()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is distinct from old.parent_id then
    with recursive sub as (
      select f.id, 0 as depth from public.folders f where f.id = new.id
      union all
      select f.id, sub.depth + 1 from public.folders f
      join sub on f.parent_id = sub.id
      where sub.depth < 100
    )
    update public.files
       set project_id = public.project_of_folder(new.id)
     where folder_id in (select id from sub);
  end if;
  return null;
end;
$$;

commit;

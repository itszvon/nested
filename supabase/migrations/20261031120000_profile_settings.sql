-- Profile fields, per-user settings, and account deletion.
--
-- Deletion runs as a definer function owned by the database, because deleting
-- an auth user needs privileges the authenticated role does not have. It only
-- ever touches the caller's own row, so no service key has to exist in the
-- application at all.

begin;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar text,
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_avatar_size;

alter table public.profiles
  add constraint profiles_avatar_size
  check (avatar is null or length(avatar) <= 250000);

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Column level: a user may change their name, picture and preferences, and
-- nothing else. storage_bytes stays trigger-owned.
grant update (display_name, avatar, settings) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  n         int := 0;
begin
  base := lower(coalesce(split_part(new.email, '@', 1), 'user'));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'user';
  end if;
  base := left(base, 28);

  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    n := n + 1;
    candidate := left(base, 28) || '_' || n::text;
  end loop;

  insert into public.profiles (id, email, username, display_name)
  values (
    new.id,
    new.email,
    candidate,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Cascades through profiles, folders, files, versions, snapshots and the
  -- profile row itself. Nothing else is touched.
  delete from auth.users where id = caller;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Keep the existing accounts consistent with the new columns.
update public.profiles set display_name = null where display_name = '';

commit;

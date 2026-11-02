-- Admin accounts and the suggestion inbox.
--
-- One admin today (the operator). `profiles.is_admin` is protected by the
-- column-level grant in 20261031120000_profile_settings.sql: authenticated
-- users may update display_name, avatar and settings only, so nobody can make
-- themselves an admin from the client.
--
-- Suggestions are written by signed-in users and read or triaged by admins.
-- The admin RLS policies use public.is_admin(), which reads the caller's own
-- profile row through a security-definer function so it cannot recurse.

begin;

-- --------------------------------------------------------------- admins

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_admin_idx
  on public.profiles (is_admin)
  where is_admin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- The operator account. Matching on the auth email keeps this independent of
-- whatever username the profile picked.
update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('pothole3000@gmail.com')
   and not p.is_admin;

-- Admins can see every profile (the user list in the admin panel).
create policy profiles_admin_select on public.profiles
  for select to authenticated
  using (public.is_admin());

-- Error events contain stack traces and paths, so they are admin-only now.
-- Before this, every signed-in account could read them.
drop policy if exists error_events_select on public.error_events;

create policy error_events_admin_select on public.error_events
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------- suggestions

create type public.suggestion_status as enum (
  'new',
  'reviewing',
  'planned',
  'shipped',
  'declined'
);

create type public.suggestion_category as enum (
  'feature',
  'bug',
  'performance',
  'design',
  'content',
  'other'
);

create table public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  body        text not null,
  category    public.suggestion_category not null default 'feature',
  status      public.suggestion_status not null default 'new',
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint suggestions_title_length check (char_length(title) between 3 and 120),
  constraint suggestions_body_length check (char_length(body) between 3 and 4000),
  constraint suggestions_note_length check (admin_note is null or char_length(admin_note) <= 2000)
);

create index suggestions_status_idx on public.suggestions (status, created_at desc);
create index suggestions_user_idx on public.suggestions (user_id, created_at desc);

create function public.suggestions_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger suggestions_touch
  before update on public.suggestions
  for each row execute function public.suggestions_touch();

alter table public.suggestions enable row level security;

create policy suggestions_insert_own on public.suggestions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy suggestions_select_own_or_admin on public.suggestions
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy suggestions_update_admin on public.suggestions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy suggestions_delete_admin on public.suggestions
  for delete to authenticated
  using (public.is_admin());

-- A user may add a suggestion. Only the status and the admin note are
-- writable, and only admins pass the policy above.
grant select, insert on public.suggestions to authenticated;
grant update (status, admin_note) on public.suggestions to authenticated;

-- ------------------------------------------------------- admin queries

-- Aggregates that need to cross owner boundaries. Both functions refuse
-- callers who are not admins, so they cannot be used to read other accounts.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'admins', (select count(*) from public.profiles where is_admin),
    'files', (select count(*) from public.files where deleted_at is null),
    'folders', (select count(*) from public.folders where deleted_at is null),
    'versions', (select count(*) from public.versions),
    'storage_bytes', (select coalesce(sum(storage_bytes), 0) from public.profiles),
    'suggestions', coalesce(
      (select jsonb_object_agg(status, total)
         from (select status::text as status, count(*) as total
                 from public.suggestions
                group by status) counts),
      '{}'::jsonb
    ),
    'open_suggestions', (select count(*) from public.suggestions
                          where status in ('new', 'reviewing', 'planned')),
    'errors_24h', (select count(*) from public.error_events
                    where created_at > now() - interval '24 hours')
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_users()
returns table (
  id uuid,
  username text,
  email text,
  display_name text,
  is_admin boolean,
  created_at timestamptz,
  storage_bytes bigint,
  files bigint,
  last_activity timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select
      p.id,
      p.username,
      p.email,
      p.display_name,
      p.is_admin,
      p.created_at,
      p.storage_bytes,
      coalesce(f.total, 0)::bigint,
      f.last_activity
    from public.profiles p
    left join (
      select owner_id, count(*) as total, max(updated_at) as last_activity
        from public.files
       where deleted_at is null
       group by owner_id
    ) f on f.owner_id = p.id
    order by p.created_at asc;
end;
$$;

revoke all on function public.admin_overview() from public;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users() to authenticated;

commit;

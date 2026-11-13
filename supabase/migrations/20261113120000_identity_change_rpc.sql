-- Identity changes run as definer functions.
--
-- `authenticated` may only update display_name, avatar and settings on
-- profiles (column grant in 20261031120000_profile_settings.sql). The two
-- identity actions wrote username and email directly and were rejected with
-- "permission denied", so they now go through narrow definer functions that
-- take no target id: the caller can only ever change their own row.

begin;

create or replace function public.set_my_username(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  p_username := lower(btrim(p_username));

  if p_username !~ '^[a-z0-9_]{3,32}$' then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;

  update public.profiles set username = p_username where id = auth.uid();
end;
$$;

revoke all on function public.set_my_username(text) from public, anon;
grant execute on function public.set_my_username(text) to authenticated;

create or replace function public.set_my_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  p_email := lower(btrim(p_email));

  if position('@' in p_email) < 2 or position('.' in split_part(p_email, '@', 2)) < 1 then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;

  update public.profiles set email = p_email where id = auth.uid();
end;
$$;

revoke all on function public.set_my_email(text) from public, anon;
grant execute on function public.set_my_email(text) to authenticated;

commit;

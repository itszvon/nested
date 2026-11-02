-- Tighten the suggestion grants to the columns a user actually owns.
--
-- The table-level INSERT grant let a caller set `status` or `admin_note` on
-- their own row at creation time. Column privileges close that without needing
-- another trigger.

begin;

revoke insert on public.suggestions from authenticated;
grant insert (user_id, title, body, category) on public.suggestions to authenticated;

-- Admin deletes are allowed by the policy, but the grant was missing.
grant delete on public.suggestions to authenticated;

commit;

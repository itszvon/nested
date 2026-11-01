-- The nightly backup reads every table with the service role. Service role
-- bypasses RLS, but it still needs table privileges, and profiles deliberately
-- had column grants for authenticated only.
grant select on public.profiles, public.folders, public.files,
  public.snapshots, public.versions, public.profile_change_requests
  to service_role;

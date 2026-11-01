-- First-party error log. Replaces the Sentry dependency for reporting: server
-- errors become rows, client errors post to /api/errors, and Settings shows the
-- most recent ones. Reads are owner-only through RLS; writes go through the
-- service role, so no client can inject rows directly.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('server', 'client')),
  message text not null,
  stack text,
  path text,
  digest text,
  created_at timestamptz not null default now()
);

create index if not exists error_events_created_idx on public.error_events (created_at desc);

alter table public.error_events enable row level security;

create policy error_events_select on public.error_events
  for select to authenticated using (true);

grant select on public.error_events to authenticated;

-- The nightly backup reads it too.
grant select on public.error_events to service_role;

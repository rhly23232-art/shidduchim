-- =============================================================================
-- שידוכים — יומן שליחת מיילים: הגבלת קצב, מניעת שליחה כפולה ומעקב
-- Written only through the `send-resume-email` Edge Function (with the user's JWT).
-- Users can read their own log; they cannot delete rows or rewrite their timestamps,
-- so the rate limit cannot be bypassed from the client.
-- =============================================================================

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  kind text not null check (kind in ('resume', 'document')),
  candidate_id uuid,
  recipient_domain text not null check (length(recipient_domain) <= 255),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_id text,
  error text check (length(error) <= 500),
  created_at timestamptz not null default now(),
  constraint email_log_idempotency unique (owner_id, idempotency_key)
);
create index email_log_owner_created_idx on public.email_log (owner_id, created_at desc);

-- Supabase grants ALL on new public tables by default: revoke first, then grant exactly.
revoke all on public.email_log from anon, authenticated;
grant select, insert on public.email_log to authenticated;
-- only the outcome columns may change after insert
grant update (status, provider_id, error) on public.email_log to authenticated;
alter table public.email_log enable row level security;

create policy "email_log: owner select" on public.email_log
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "email_log: owner insert" on public.email_log
  for insert to authenticated
  with check ((select auth.uid()) = owner_id and status = 'pending' and created_at > now() - interval '1 minute');
create policy "email_log: owner update" on public.email_log
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Same principle for the history table: no updates at all (append-only).
revoke all on public.journal from anon, authenticated;
grant select, insert, delete on public.journal to authenticated;

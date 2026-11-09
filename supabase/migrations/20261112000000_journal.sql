-- =============================================================================
-- שידוכים — היסטוריית שינויים וסל מחזור
-- Each row: one change (create / edit / delete of a candidate, delete of an idea).
-- `data` holds the snapshot needed to show the change and to restore it.
-- Files of deleted candidates are kept in the private `journal` bucket:
--   {owner_id}/{journal_id}/{filename}
-- =============================================================================

create table public.journal (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('create', 'edit', 'delete', 'idea_delete', 'restore')),
  candidate_id uuid,
  title text not null check (length(title) <= 300),
  at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);
create index journal_owner_at_idx on public.journal (owner_id, at desc);
create index journal_candidate_idx on public.journal (owner_id, candidate_id, at desc);

revoke all on public.journal from anon;
grant select, insert, delete on public.journal to authenticated;
alter table public.journal enable row level security;

create policy "journal: owner select" on public.journal
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "journal: owner insert" on public.journal
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "journal: owner delete" on public.journal
  for delete to authenticated using ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'journal',
  'journal',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

create policy "journal bucket: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "journal bucket: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "journal bucket: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

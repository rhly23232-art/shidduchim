-- =============================================================================
-- שידוכים — תמונת מועמד (אחת לכל מועמד)
-- Any image type is accepted in the app and converted in the browser to JPEG (≤ 1600px,
-- no metadata), so the server only ever stores image/jpeg. Additive only.
-- =============================================================================

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  storage_path text not null,
  file_name text not null check (length(file_name) between 1 and 255),
  mime_type text not null check (mime_type = 'image/jpeg'),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  uploaded_at timestamptz not null default now(),
  constraint photos_one_per_candidate unique (candidate_id)
);

-- Supabase grants ALL on new tables by default: start from nothing.
revoke all on public.photos from anon, authenticated;
grant select, insert, update, delete on public.photos to authenticated;
alter table public.photos enable row level security;

create policy "photos: owner all" on public.photos
  for all to authenticated
  using (public.owns_candidate(candidate_id))
  with check (public.owns_candidate(candidate_id));

-- The view gains the photo summary (same shape as the resume columns).
drop view public.candidates_view;
create view public.candidates_view
with (security_invoker = true) as
select
  c.*,
  coalesce(
    date_part('year', age(c.birth_date)),
    c.age_years + date_part('year', age(c.age_recorded_on))
  )::int as age,
  r.id as resume_id,
  r.file_name as resume_file_name,
  r.mime_type as resume_mime_type,
  r.size_bytes as resume_size_bytes,
  r.storage_path as resume_storage_path,
  r.uploaded_at as resume_uploaded_at,
  p.id as photo_id,
  p.file_name as photo_file_name,
  p.mime_type as photo_mime_type,
  p.size_bytes as photo_size_bytes,
  p.storage_path as photo_storage_path,
  p.uploaded_at as photo_uploaded_at
from public.candidates c
left join public.resumes r on r.candidate_id = c.id
left join public.photos p on p.candidate_id = c.id;
grant select on public.candidates_view to authenticated;
revoke all on public.candidates_view from anon;

-- ---------- Storage: private photos bucket --------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {owner_id}/{candidate_id}/{filename}
create policy "photos bucket: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "photos bucket: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.owns_candidate(((storage.foldername(name))[2])::uuid)
  );

create policy "photos bucket: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "photos bucket: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

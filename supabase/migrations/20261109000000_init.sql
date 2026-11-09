-- =============================================================================
-- שידוכים — סכמה ראשונית
-- טבלאות, טיפוסים, אינדקסים, הרשאות, RLS, View עם גיל מחושב, RPC לשמירה אטומית,
-- ו-bucket פרטי לקורות חיים (רזומה) עם מדיניות גישה לתיקיית הבעלים בלבד.
-- =============================================================================

-- ---------- Types ----------------------------------------------------------------
create type public.gender as enum ('male', 'female');

-- ---------- Tables ---------------------------------------------------------------
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gender public.gender not null,
  first_name text not null check (length(btrim(first_name)) between 1 and 60),
  last_name text not null check (length(btrim(last_name)) between 1 and 60),
  birth_date date check (birth_date >= date '1940-01-01'),
  hebrew_birth_date text,
  city text,
  region text,
  country_of_origin text,
  community text,
  chassidut text,
  height_cm int check (height_cm between 120 and 230),
  appearance text,
  institution text,
  institution_type text,
  education_history jsonb not null default '[]'::jsonb check (jsonb_typeof(education_history) = 'array'),
  occupation text,
  degree text,
  future_plans text,
  character_description text,
  desired_home_style text,
  special_requirements text,
  general_notes text,
  status text not null default 'active' check (status in ('active', 'in_process', 'engaged', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_details (
  candidate_id uuid primary key references public.candidates (id) on delete cascade,
  father_name text,
  father_occupation text,
  mother_name text,
  mother_occupation text,
  mother_maiden_name text,
  lineage text,
  siblings_count int check (siblings_count between 0 and 30),
  birth_order int check (birth_order between 1 and 31)
);

create table public.in_laws (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  relation text not null,
  full_name text not null,
  details text,
  sort_order int not null default 0
);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    )
  ),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_at timestamptz not null default now(),
  constraint resumes_one_per_candidate unique (candidate_id)
);

-- ---------- Indexes --------------------------------------------------------------
create index candidates_owner_gender_idx on public.candidates (owner_id, gender);
create index candidates_gender_idx on public.candidates (gender);
create index candidates_city_idx on public.candidates (city);
create index candidates_institution_idx on public.candidates (institution);
create index candidates_community_idx on public.candidates (community);
create index candidates_birth_date_idx on public.candidates (birth_date);
create index in_laws_candidate_idx on public.in_laws (candidate_id, sort_order);

-- ---------- updated_at trigger ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger candidates_set_updated_at
before update on public.candidates
for each row execute function public.set_updated_at();

-- ---------- View with computed age (RLS-aware via security_invoker) -------------
create view public.candidates_view
with (security_invoker = true) as
select
  c.*,
  date_part('year', age(c.birth_date))::int as age,
  r.id as resume_id,
  r.file_name as resume_file_name,
  r.mime_type as resume_mime_type,
  r.size_bytes as resume_size_bytes,
  r.storage_path as resume_storage_path,
  r.uploaded_at as resume_uploaded_at
from public.candidates c
left join public.resumes r on r.candidate_id = c.id;

-- ---------- Grants ---------------------------------------------------------------
revoke all on public.candidates, public.family_details, public.in_laws, public.resumes from anon;
revoke all on public.candidates_view from anon;
grant usage on schema public to authenticated;
grant usage on type public.gender to authenticated;
grant select, insert, update, delete on public.candidates to authenticated;
grant select, insert, update, delete on public.family_details to authenticated;
grant select, insert, update, delete on public.in_laws to authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select on public.candidates_view to authenticated;

-- ---------- Row Level Security ---------------------------------------------------
alter table public.candidates enable row level security;
alter table public.family_details enable row level security;
alter table public.in_laws enable row level security;
alter table public.resumes enable row level security;

create policy "candidates: owner select" on public.candidates
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "candidates: owner insert" on public.candidates
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "candidates: owner update" on public.candidates
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "candidates: owner delete" on public.candidates
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Helper: does the current user own this candidate?
create or replace function public.owns_candidate(cid uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.candidates c
    where c.id = cid and c.owner_id = (select auth.uid())
  );
$$;
grant execute on function public.owns_candidate(uuid) to authenticated;

create policy "family_details: owner all" on public.family_details
  for all to authenticated
  using (public.owns_candidate(candidate_id))
  with check (public.owns_candidate(candidate_id));

create policy "in_laws: owner all" on public.in_laws
  for all to authenticated
  using (public.owns_candidate(candidate_id))
  with check (public.owns_candidate(candidate_id));

create policy "resumes: owner all" on public.resumes
  for all to authenticated
  using (public.owns_candidate(candidate_id))
  with check (public.owns_candidate(candidate_id));

-- ---------- Atomic save (candidate + family + in-laws) --------------------------
-- payload = { id?: uuid, candidate: {...}, family: {...} | null, in_laws: [{relation, full_name, details}] }
-- SECURITY INVOKER: every statement is still subject to the RLS policies above.
create or replace function public.save_candidate(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  c public.candidates;
  f public.family_details;
begin
  c := jsonb_populate_record(null::public.candidates, coalesce(payload -> 'candidate', '{}'::jsonb));

  if v_id is null then
    insert into public.candidates (
      gender, first_name, last_name, birth_date, hebrew_birth_date, city, region,
      country_of_origin, community, chassidut, height_cm, appearance, institution,
      institution_type, education_history, occupation, degree, future_plans,
      character_description, desired_home_style, special_requirements, general_notes, status
    ) values (
      c.gender, c.first_name, c.last_name, c.birth_date, c.hebrew_birth_date, c.city, c.region,
      c.country_of_origin, c.community, c.chassidut, c.height_cm, c.appearance, c.institution,
      c.institution_type, coalesce(c.education_history, '[]'::jsonb), c.occupation, c.degree,
      c.future_plans, c.character_description, c.desired_home_style, c.special_requirements,
      c.general_notes, coalesce(c.status, 'active')
    )
    returning id into v_id;
  else
    update public.candidates set
      gender = c.gender,
      first_name = c.first_name,
      last_name = c.last_name,
      birth_date = c.birth_date,
      hebrew_birth_date = c.hebrew_birth_date,
      city = c.city,
      region = c.region,
      country_of_origin = c.country_of_origin,
      community = c.community,
      chassidut = c.chassidut,
      height_cm = c.height_cm,
      appearance = c.appearance,
      institution = c.institution,
      institution_type = c.institution_type,
      education_history = coalesce(c.education_history, '[]'::jsonb),
      occupation = c.occupation,
      degree = c.degree,
      future_plans = c.future_plans,
      character_description = c.character_description,
      desired_home_style = c.desired_home_style,
      special_requirements = c.special_requirements,
      general_notes = c.general_notes,
      status = coalesce(c.status, 'active')
    where id = v_id;

    if not found then
      raise exception 'candidate % not found', v_id using errcode = 'P0002';
    end if;
  end if;

  if payload ? 'family' and jsonb_typeof(payload -> 'family') = 'object' then
    f := jsonb_populate_record(null::public.family_details, payload -> 'family');
    insert into public.family_details (
      candidate_id, father_name, father_occupation, mother_name, mother_occupation,
      mother_maiden_name, lineage, siblings_count, birth_order
    ) values (
      v_id, f.father_name, f.father_occupation, f.mother_name, f.mother_occupation,
      f.mother_maiden_name, f.lineage, f.siblings_count, f.birth_order
    )
    on conflict (candidate_id) do update set
      father_name = excluded.father_name,
      father_occupation = excluded.father_occupation,
      mother_name = excluded.mother_name,
      mother_occupation = excluded.mother_occupation,
      mother_maiden_name = excluded.mother_maiden_name,
      lineage = excluded.lineage,
      siblings_count = excluded.siblings_count,
      birth_order = excluded.birth_order;
  end if;

  if payload ? 'in_laws' and jsonb_typeof(payload -> 'in_laws') = 'array' then
    delete from public.in_laws where candidate_id = v_id;
    insert into public.in_laws (candidate_id, relation, full_name, details, sort_order)
    select v_id, x.relation, x.full_name, nullif(x.details, ''), (t.ord - 1)::int
    from jsonb_array_elements(payload -> 'in_laws') with ordinality as t (elem, ord)
    cross join lateral jsonb_to_record(t.elem) as x (relation text, full_name text, details text)
    where nullif(btrim(x.full_name), '') is not null;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.save_candidate(jsonb) from public, anon;
grant execute on function public.save_candidate(jsonb) to authenticated;

-- ---------- Storage: private resumes bucket --------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {owner_id}/{candidate_id}/{filename}
create policy "resumes bucket: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes bucket: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.owns_candidate(((storage.foldername(name))[2])::uuid)
  );

create policy "resumes bucket: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes bucket: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

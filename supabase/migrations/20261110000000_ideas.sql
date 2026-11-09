-- =============================================================================
-- שידוכים — פנקס רעיונות של השדכן
-- =============================================================================

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  body text check (length(body) <= 4000),
  male_id uuid references public.candidates (id) on delete set null,
  female_id uuid references public.candidates (id) on delete set null,
  pinned boolean not null default false,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_owner_idx on public.ideas (owner_id, pinned desc, updated_at desc);

create trigger ideas_set_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();

revoke all on public.ideas from anon;
grant select, insert, update, delete on public.ideas to authenticated;
alter table public.ideas enable row level security;

create policy "ideas: owner all" on public.ideas for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (male_id is null or public.owns_candidate(male_id))
    and (female_id is null or public.owns_candidate(female_id))
  );

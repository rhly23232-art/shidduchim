-- =============================================================================
-- שידוכים — ניהול השדכן: הצעות (עם היסטוריה), רעיונות ומשימות/תזכורות
-- =============================================================================

create type public.proposal_stage as enum ('idea', 'suggested', 'checking', 'meeting', 'engaged', 'closed');
create type public.side_response as enum ('pending', 'interested', 'declined');

-- ---------- Proposals -------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  male_id uuid not null references public.candidates (id) on delete cascade,
  female_id uuid not null references public.candidates (id) on delete cascade,
  stage public.proposal_stage not null default 'idea',
  male_response public.side_response not null default 'pending',
  female_response public.side_response not null default 'pending',
  next_followup date,
  notes text check (length(notes) <= 4000),
  closed_reason text check (length(closed_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposals_one_per_pair unique (owner_id, male_id, female_id)
);
create index proposals_owner_stage_idx on public.proposals (owner_id, stage);
create index proposals_male_idx on public.proposals (male_id);
create index proposals_female_idx on public.proposals (female_id);
create index proposals_followup_idx on public.proposals (next_followup) where next_followup is not null;

create table public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  kind text not null check (kind in ('created', 'stage', 'response', 'note')),
  from_stage public.proposal_stage,
  to_stage public.proposal_stage,
  side public.gender,
  response public.side_response,
  text text check (length(text) <= 2000),
  created_at timestamptz not null default now()
);
create index proposal_events_proposal_idx on public.proposal_events (proposal_id, created_at desc);

-- ---------- Ideas ------------------------------------------------------------------
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

-- ---------- Tasks / reminders --------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  due_date date,
  done boolean not null default false,
  candidate_id uuid references public.candidates (id) on delete set null,
  proposal_id uuid references public.proposals (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_owner_due_idx on public.tasks (owner_id, done, due_date);

-- ---------- Triggers ---------------------------------------------------------------
create trigger proposals_set_updated_at before update on public.proposals
  for each row execute function public.set_updated_at();
create trigger ideas_set_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- A proposal must pair the owner's בחור with the owner's בחורה.
create or replace function public.check_proposal_pair()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.candidates where id = new.male_id and gender = 'male' and owner_id = new.owner_id)
     or not exists (select 1 from public.candidates where id = new.female_id and gender = 'female' and owner_id = new.owner_id) then
    raise exception 'proposal must pair your own male and female candidates' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger proposals_check_pair before insert or update of male_id, female_id on public.proposals
  for each row execute function public.check_proposal_pair();

-- Automatic history: creation, stage moves and side responses.
create or replace function public.log_proposal_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.proposal_events (proposal_id, kind, to_stage) values (new.id, 'created', new.stage);
    return new;
  end if;
  if new.stage is distinct from old.stage then
    insert into public.proposal_events (proposal_id, kind, from_stage, to_stage, text)
    values (new.id, 'stage', old.stage, new.stage, case when new.stage = 'closed' then new.closed_reason end);
  end if;
  if new.male_response is distinct from old.male_response then
    insert into public.proposal_events (proposal_id, kind, side, response) values (new.id, 'response', 'male', new.male_response);
  end if;
  if new.female_response is distinct from old.female_response then
    insert into public.proposal_events (proposal_id, kind, side, response) values (new.id, 'response', 'female', new.female_response);
  end if;
  return new;
end;
$$;
create trigger proposals_log_event after insert or update on public.proposals
  for each row execute function public.log_proposal_event();

-- ---------- Grants & RLS -------------------------------------------------------------
revoke all on public.proposals, public.proposal_events, public.ideas, public.tasks from anon;
grant usage on type public.proposal_stage, public.side_response to authenticated;
grant select, insert, update, delete on public.proposals, public.proposal_events, public.ideas, public.tasks to authenticated;

alter table public.proposals enable row level security;
alter table public.proposal_events enable row level security;
alter table public.ideas enable row level security;
alter table public.tasks enable row level security;

create policy "proposals: owner all" on public.proposals for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and public.owns_candidate(male_id)
    and public.owns_candidate(female_id)
  );

create or replace function public.owns_proposal(pid uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.proposals p where p.id = pid and p.owner_id = (select auth.uid()));
$$;
grant execute on function public.owns_proposal(uuid) to authenticated;

create policy "proposal_events: owner all" on public.proposal_events for all to authenticated
  using (public.owns_proposal(proposal_id))
  with check (public.owns_proposal(proposal_id));

create policy "ideas: owner all" on public.ideas for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (male_id is null or public.owns_candidate(male_id))
    and (female_id is null or public.owns_candidate(female_id))
  );

create policy "tasks: owner all" on public.tasks for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (candidate_id is null or public.owns_candidate(candidate_id))
    and (proposal_id is null or public.owns_proposal(proposal_id))
  );

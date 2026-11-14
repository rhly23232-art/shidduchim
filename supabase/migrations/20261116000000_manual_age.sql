-- =============================================================================
-- שידוכים — גיל ללא תאריך לידה מדויק
-- age_years: the age the matchmaker typed, age_recorded_on: the day it was typed.
-- The effective age is computed from birth_date when there is one; otherwise it is
-- age_years plus the full years that have passed since age_recorded_on (it grows by itself).
-- Additive only: no existing data changes.
-- =============================================================================

alter table public.candidates
  add column age_years smallint check (age_years between 16 and 70),
  add column age_recorded_on date,
  add constraint candidates_age_pair check ((age_years is null) = (age_recorded_on is null));

-- The view lists c.* — recreate it so it includes the new columns and the effective age.
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
  r.uploaded_at as resume_uploaded_at
from public.candidates c
left join public.resumes r on r.candidate_id = c.id;
grant select on public.candidates_view to authenticated;
revoke all on public.candidates_view from anon;

create or replace function public.save_candidate(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_expected timestamptz := nullif(payload ->> 'expected_updated_at', '')::timestamptz;
  c public.candidates;
  f public.family_details;
begin
  c := jsonb_populate_record(null::public.candidates, coalesce(payload -> 'candidate', '{}'::jsonb));

  if v_id is null then
    insert into public.candidates (
      gender, first_name, last_name, birth_date, hebrew_birth_date, city, region,
      country_of_origin, community, chassidut, height_cm, appearance, institution,
      institution_type, education_history, occupation, degree, future_plans,
      character_description, desired_home_style, special_requirements, general_notes, status, eda,
      age_years, age_recorded_on
    ) values (
      c.gender, c.first_name, c.last_name, c.birth_date, c.hebrew_birth_date, c.city, c.region,
      c.country_of_origin, c.community, c.chassidut, c.height_cm, c.appearance, c.institution,
      c.institution_type, coalesce(c.education_history, '[]'::jsonb), c.occupation, c.degree,
      c.future_plans, c.character_description, c.desired_home_style, c.special_requirements,
      c.general_notes, coalesce(c.status, 'active'), c.eda,
      c.age_years, c.age_recorded_on
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
      eda = c.eda,
      age_years = c.age_years,
      age_recorded_on = c.age_recorded_on,
      status = coalesce(c.status, 'active')
    where id = v_id
      and (v_expected is null or updated_at = v_expected);

    if not found then
      if v_expected is not null and exists (select 1 from public.candidates where id = v_id) then
        -- someone else saved this card after it was opened: refuse to overwrite silently
        raise exception 'candidate % was modified by another session', v_id
          using errcode = 'P0409', hint = 'conflict';
      end if;
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

grant execute on function public.save_candidate(jsonb) to authenticated;

-- =============================================================================
-- שידוכים — הגנה מעריכה מקבילה (optimistic concurrency)
-- save_candidate accepts an optional `expected_updated_at`. When it is sent and the row was
-- changed since (another tab / device / user session), the update is refused with
-- SQLSTATE P0409 instead of silently overwriting. Callers without it keep the old behavior.
-- =============================================================================

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
      character_description, desired_home_style, special_requirements, general_notes, status, eda
    ) values (
      c.gender, c.first_name, c.last_name, c.birth_date, c.hebrew_birth_date, c.city, c.region,
      c.country_of_origin, c.community, c.chassidut, c.height_cm, c.appearance, c.institution,
      c.institution_type, coalesce(c.education_history, '[]'::jsonb), c.occupation, c.degree,
      c.future_plans, c.character_description, c.desired_home_style, c.special_requirements,
      c.general_notes, coalesce(c.status, 'active'), c.eda
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

-- Keep candidate identity/link creation and the append-only create event in one transaction.

create or replace function public.create_bean_identity_candidate(
  p_coffee_catalog_id integer,
  p_identity_id uuid default null,
  p_canonical_name text default null,
  p_snapshot jsonb default '{}'::jsonb,
  p_actor_id uuid default null,
  p_allow_after_rejection boolean default false
)
returns table(identity jsonb, link jsonb, event jsonb)
language plpgsql
as $$
declare
  v_identity public.bean_identities%rowtype;
  v_link public.bean_identity_links%rowtype;
  v_event public.bean_identity_events%rowtype;
  v_identity_json jsonb;
  v_reason_codes text[];
begin
  if p_snapshot is null then
    raise exception 'Candidate snapshot is required';
  end if;

  if not p_allow_after_rejection and exists (
    select 1
    from public.bean_identity_links rejected
    where rejected.coffee_catalog_id = p_coffee_catalog_id
      and rejected.status = 'rejected'
      and (p_identity_id is null or rejected.identity_id = p_identity_id)
  ) then
    raise exception 'Coffee catalog row % has a rejected identity candidate', p_coffee_catalog_id;
  end if;

  select coalesce(array_agg(value), '{}'::text[])
  into v_reason_codes
  from jsonb_array_elements_text(coalesce(p_snapshot->'reasonCodes', '[]'::jsonb)) as reason_codes(value);

  if p_identity_id is null then
    insert into public.bean_identities (status, canonical_name, primary_catalog_id, metadata)
    values (
      'candidate',
      p_canonical_name,
      p_coffee_catalog_id,
      coalesce(p_snapshot->'metadata', '{}'::jsonb)
    )
    returning * into v_identity;

    v_identity_json := to_jsonb(v_identity);
  else
    select *
    into v_identity
    from public.bean_identities
    where id = p_identity_id
    for update;

    if not found then
      raise exception 'Bean identity % was not found', p_identity_id;
    end if;

    update public.bean_identities
    set status = 'candidate',
        primary_catalog_id = p_coffee_catalog_id
    where id = v_identity.id
    returning * into v_identity;

    v_identity_json := null;
  end if;

  insert into public.bean_identity_links (
    identity_id,
    coffee_catalog_id,
    status,
    active,
    classifier_version,
    dimension_scores,
    blockers,
    proof_summary_snapshot,
    reason_codes,
    metadata,
    proposed_by
  )
  values (
    v_identity.id,
    p_coffee_catalog_id,
    'candidate',
    true,
    p_snapshot->>'classifierVersion',
    coalesce(p_snapshot->'dimensionScores', '{}'::jsonb),
    coalesce(p_snapshot->'blockers', '[]'::jsonb),
    coalesce(p_snapshot->'proofSummarySnapshot', '{}'::jsonb),
    coalesce(v_reason_codes, '{}'::text[]),
    coalesce(p_snapshot->'metadata', '{}'::jsonb),
    p_actor_id
  )
  returning * into v_link;

  insert into public.bean_identity_events (identity_id, link_id, action, actor_id, payload)
  values (
    v_link.identity_id,
    v_link.id,
    'create',
    p_actor_id,
    jsonb_build_object(
      'coffee_catalog_id', p_coffee_catalog_id,
      'candidate_snapshot', p_snapshot
    )
  )
  returning * into v_event;

  return query select v_identity_json, to_jsonb(v_link), to_jsonb(v_event);
end;
$$;

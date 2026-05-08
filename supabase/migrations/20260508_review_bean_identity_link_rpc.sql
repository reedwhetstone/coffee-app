-- Keep bean identity review state and audit history in one database transaction.

create or replace function public.review_bean_identity_link(
  p_link_id uuid,
  p_action text,
  p_actor_id uuid default null,
  p_reason_codes text[] default '{}'::text[],
  p_metadata jsonb default '{}'::jsonb,
  p_note text default null,
  p_superseded_by_link_id uuid default null
)
returns table(link jsonb, event jsonb)
language plpgsql
as $$
declare
  v_existing public.bean_identity_links%rowtype;
  v_updated public.bean_identity_links%rowtype;
  v_event public.bean_identity_events%rowtype;
  v_replacement public.bean_identity_links%rowtype;
  v_identity_status text;
  v_primary_catalog_id integer;
  v_payload jsonb;
begin
  if p_action not in ('accept', 'reject', 'supersede') then
    raise exception 'Unsupported bean identity review action: %', p_action;
  end if;

  select *
  into v_existing
  from public.bean_identity_links
  where id = p_link_id
  for update;

  if not found then
    raise exception 'Bean identity link % was not found', p_link_id;
  end if;

  if p_action = 'accept' and exists (
    select 1
    from public.bean_identity_links
    where coffee_catalog_id = v_existing.coffee_catalog_id
      and status = 'accepted'
      and active = true
      and id <> v_existing.id
  ) then
    raise exception 'Coffee catalog row % already has an active accepted identity link',
      v_existing.coffee_catalog_id;
  end if;

  if p_action = 'supersede' and p_superseded_by_link_id is not null then
    select *
    into v_replacement
    from public.bean_identity_links
    where id = p_superseded_by_link_id;

    if not found then
      raise exception 'Replacement bean identity link % was not found', p_superseded_by_link_id;
    end if;
  end if;

  update public.bean_identity_links
  set
    status = case p_action
      when 'accept' then 'accepted'
      when 'reject' then 'rejected'
      when 'supersede' then 'superseded'
    end,
    active = p_action = 'accept',
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    superseded_by = case when p_action = 'supersede' then p_superseded_by_link_id else superseded_by end,
    reason_codes = coalesce(
      array(select distinct reason_code from unnest(reason_codes || coalesce(p_reason_codes, '{}'::text[])) as codes(reason_code)),
      '{}'::text[]
    ),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where id = v_existing.id
  returning * into v_updated;

  v_payload := jsonb_build_object(
    'previous_status', v_existing.status,
    'reason_codes', to_jsonb(coalesce(p_reason_codes, '{}'::text[])),
    'metadata', coalesce(p_metadata, '{}'::jsonb),
    'note', p_note
  );

  if p_action = 'supersede' then
    v_payload := v_payload || jsonb_build_object('superseded_by_link_id', p_superseded_by_link_id);
  end if;

  insert into public.bean_identity_events (identity_id, link_id, action, actor_id, payload)
  values (v_updated.identity_id, v_updated.id, p_action, p_actor_id, v_payload)
  returning * into v_event;

  if p_action = 'accept' then
    update public.bean_identities
    set status = 'accepted',
        primary_catalog_id = v_updated.coffee_catalog_id,
        superseded_by = null
    where id = v_updated.identity_id;
  elsif p_action = 'reject' then
    select accepted.status, accepted.coffee_catalog_id
    into v_identity_status, v_primary_catalog_id
    from public.bean_identity_links accepted
    where accepted.identity_id = v_updated.identity_id
      and accepted.status = 'accepted'
      and accepted.active = true
    order by accepted.reviewed_at desc nulls last, accepted.created_at desc
    limit 1;

    if v_identity_status = 'accepted' then
      update public.bean_identities
      set status = 'accepted', primary_catalog_id = v_primary_catalog_id, superseded_by = null
      where id = v_updated.identity_id;
    elsif exists (
      select 1
      from public.bean_identity_links candidate
      where candidate.identity_id = v_updated.identity_id
        and candidate.status = 'candidate'
        and candidate.active = true
    ) then
      update public.bean_identities
      set status = 'candidate'
      where id = v_updated.identity_id;
    else
      update public.bean_identities
      set status = 'rejected'
      where id = v_updated.identity_id;
    end if;
  elsif p_action = 'supersede' then
    if exists (
      select 1
      from public.bean_identity_links accepted
      where accepted.identity_id = v_updated.identity_id
        and accepted.status = 'accepted'
        and accepted.active = true
    ) then
      update public.bean_identities
      set status = 'accepted', superseded_by = null
      where id = v_updated.identity_id;
    elsif exists (
      select 1
      from public.bean_identity_links candidate
      where candidate.identity_id = v_updated.identity_id
        and candidate.status = 'candidate'
        and candidate.active = true
    ) then
      update public.bean_identities
      set status = 'candidate'
      where id = v_updated.identity_id;
    else
      update public.bean_identities
      set status = 'superseded', superseded_by = v_replacement.identity_id
      where id = v_updated.identity_id;
    end if;
  end if;

  return query select to_jsonb(v_updated), to_jsonb(v_event);
end;
$$;

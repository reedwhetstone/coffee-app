-- Durable, atomic execution ledger for chat-proposed writes.
create table public.chat_action_executions (
  user_id uuid not null references auth.users(id) on delete cascade,
  execution_id text not null,
  action_type text not null,
  fields jsonb not null,
  status text not null check (status in ('pending', 'success')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  primary key (user_id, execution_id)
);

alter table public.chat_action_executions enable row level security;
create policy "Users read own chat action executions" on public.chat_action_executions
  for select using (auth.uid() = user_id);

create or replace function public.execute_chat_action(
  p_execution_id text,
  p_action_type text,
  p_fields jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.chat_action_executions%rowtype;
  v_id bigint;
  v_catalog_id bigint;
  v_owner uuid;
  v_result jsonb;
  v_roasted_oz numeric;
  v_today text := current_date::text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.user_roles r where r.id = v_user
      and (
        r.role in ('member'::public.user_role, 'admin'::public.user_role)
        or coalesce(r.user_role, '{}'::text[]) && array['member', 'admin']::text[]
        or (p_action_type in ('add_bean_to_inventory','update_bean') and coalesce(r.ppi_access,false))
      )
  ) then
    raise exception 'Action entitlement required' using errcode = '42501';
  end if;
  if p_execution_id is null or length(p_execution_id) not between 1 and 200 then
    raise exception 'Invalid execution ID' using errcode = '22023';
  end if;

  select * into v_existing from public.chat_action_executions
    where user_id = v_user and execution_id = p_execution_id for update;
  if found then
    if v_existing.action_type <> p_action_type or v_existing.fields <> p_fields then
      raise exception 'Execution ID conflicts with a different action payload' using errcode = '23505';
    end if;
    return jsonb_build_object('replayed', true, 'status', v_existing.status,
      'result', v_existing.result, 'error', v_existing.error);
  end if;

  -- The ledger row serializes concurrent requests. The business write and final
  -- result are committed in this same transaction.
  insert into public.chat_action_executions(user_id, execution_id, action_type, fields, status)
    values (v_user, p_execution_id, p_action_type, p_fields, 'pending');

  if p_action_type = 'add_bean_to_inventory' then
    v_catalog_id := nullif(p_fields->>'catalog_id', '')::bigint;
    if v_catalog_id is null then v_catalog_id := nullif(p_fields->>'coffee_bean', '')::bigint; end if;
    if v_catalog_id is null and nullif(p_fields->>'manual_name', '') is not null then
      insert into public.coffee_catalog(name, coffee_user, public_coffee, last_updated)
        values (p_fields->>'manual_name', v_user, false, current_date) returning id into v_catalog_id;
    end if;
    if v_catalog_id is null then raise exception 'Either catalog_id or manual_name is required' using errcode='22023'; end if;
    insert into public.green_coffee_inv("user", catalog_id, purchased_qty_lbs, bean_cost,
      tax_ship_cost, purchase_date, notes, stocked, last_updated)
    values (v_user, v_catalog_id, coalesce(nullif(p_fields->>'purchased_qty_lbs','')::numeric,0),
      round(coalesce(nullif(p_fields->>'cost_per_lb','')::numeric,0) * coalesce(nullif(p_fields->>'purchased_qty_lbs','')::numeric,0),2),
      coalesce(nullif(p_fields->>'tax_ship_cost','')::numeric,0), coalesce(nullif(p_fields->>'purchase_date','')::date,current_date),
      coalesce(p_fields->>'notes',''), true, now()) returning id into v_id;
    v_result := jsonb_build_object('success',true,'id',v_id,'message','Bean added to inventory');
  elsif p_action_type = 'update_bean' then
    v_id := nullif(p_fields->>'bean_id','')::bigint;
    select "user" into v_owner from public.green_coffee_inv where id=v_id;
    if v_owner is distinct from v_user then raise exception 'Bean not found or unauthorized' using errcode='42501'; end if;
    update public.green_coffee_inv set
      rank=case when p_fields ? 'rank' then (p_fields->>'rank')::numeric else rank end,
      notes=case when p_fields ? 'notes' then p_fields->>'notes' else notes end,
      stocked=case when p_fields ? 'stocked' then (p_fields->>'stocked')::boolean else stocked end,
      purchased_qty_lbs=case when p_fields ? 'purchased_qty_lbs' then (p_fields->>'purchased_qty_lbs')::numeric else purchased_qty_lbs end,
      last_updated=now() where id=v_id and "user"=v_user;
    if p_fields ? 'purchased_qty_lbs' and not (p_fields ? 'stocked') then
      select coalesce(sum(coalesce(oz_in, 0)), 0) into v_roasted_oz
        from public.roast_profiles where coffee_id=v_id and "user"=v_user;
      update public.green_coffee_inv
        set stocked=((coalesce(purchased_qty_lbs, 0) * 16 - v_roasted_oz) >= 4)
        where id=v_id and "user"=v_user;
    end if;
    v_result := jsonb_build_object('success',true,'id',v_id,'message','Bean updated');
  elsif p_action_type = 'create_roast_session' then
    v_catalog_id := nullif(p_fields->>'coffee_id','')::bigint;
    select "user" into v_owner from public.green_coffee_inv where id=v_catalog_id;
    if v_owner is distinct from v_user then raise exception 'Coffee not found or unauthorized' using errcode='42501'; end if;
    insert into public.roast_profiles("user",coffee_id,coffee_name,batch_name,roast_date,oz_in,roast_notes,roaster_type,last_updated)
    values(v_user,v_catalog_id,coalesce(p_fields->>'coffee_name',''),coalesce(p_fields->>'batch_name',''),
      coalesce(nullif(p_fields->>'roast_date','')::date,current_date),nullif(p_fields->>'oz_in','')::numeric,
      nullif(p_fields->>'roast_notes',''),nullif(p_fields->>'roaster_type',''),now()) returning roast_id into v_id;
    v_result := jsonb_build_object('success',true,'id',v_id,'message','Roast session created');
  elsif p_action_type = 'update_roast_notes' then
    v_id := nullif(p_fields->>'roast_id','')::bigint;
    select "user" into v_owner from public.roast_profiles where roast_id=v_id;
    if v_owner is distinct from v_user then raise exception 'Roast not found or unauthorized' using errcode='42501'; end if;
    update public.roast_profiles set roast_notes=case when p_fields?'roast_notes' then p_fields->>'roast_notes' else roast_notes end,
      roast_targets=case when p_fields?'roast_targets' then p_fields->>'roast_targets' else roast_targets end,last_updated=now()
      where roast_id=v_id and "user"=v_user;
    v_result := jsonb_build_object('success',true,'id',v_id,'message','Roast notes updated');
  elsif p_action_type = 'record_sale' then
    v_catalog_id := nullif(p_fields->>'green_coffee_inv_id','')::bigint;
    select "user" into v_owner from public.green_coffee_inv where id=v_catalog_id;
    if v_owner is distinct from v_user then raise exception 'Inventory item not found or unauthorized' using errcode='42501'; end if;
    insert into public.sales("user",green_coffee_inv_id,batch_name,oz_sold,price,buyer,sell_date,purchase_date)
    values(v_user,v_catalog_id,nullif(p_fields->>'batch_name',''),coalesce(nullif(p_fields->>'oz_sold','')::numeric,0),
      coalesce(nullif(p_fields->>'price','')::numeric,0),coalesce(p_fields->>'buyer',''),
      coalesce(nullif(p_fields->>'sell_date','')::date,current_date),coalesce(nullif(p_fields->>'purchase_date','')::date,current_date)) returning id into v_id;
    select coalesce(sum(coalesce(oz_in, 0)), 0) into v_roasted_oz
      from public.roast_profiles where coffee_id=v_catalog_id and "user"=v_user;
    update public.green_coffee_inv
      set stocked=((coalesce(purchased_qty_lbs, 0) * 16 - v_roasted_oz) >= 4)
      where id=v_catalog_id and "user"=v_user;
    v_result := jsonb_build_object('success',true,'id',v_id,'message','Sale recorded');
  else
    raise exception 'Unknown action type: %', p_action_type using errcode='22023';
  end if;

  update public.chat_action_executions set status='success',result=v_result,error=null,completed_at=now()
    where user_id=v_user and execution_id=p_execution_id;
  return jsonb_build_object('replayed',false,'status','success','result',v_result);
exception when unique_violation then
  select * into v_existing from public.chat_action_executions where user_id=v_user and execution_id=p_execution_id;
  if v_existing.action_type = p_action_type and v_existing.fields = p_fields then
    return jsonb_build_object('replayed',true,'status',v_existing.status,'result',v_existing.result,'error',v_existing.error);
  end if;
  raise exception 'Execution ID conflicts with a different action payload' using errcode='23505';
end;
$$;

revoke all on function public.execute_chat_action(text,text,jsonb) from public;
revoke insert, update, delete on public.chat_action_executions from anon, authenticated;
grant select on public.chat_action_executions to authenticated;
grant execute on function public.execute_chat_action(text,text,jsonb) to authenticated;

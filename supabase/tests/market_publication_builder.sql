-- Executable behavior contract. Run after foundation + builder migrations in a disposable DB.
begin;

insert into public.market_index_cohorts(id,cohort_key,version,methodology_version,expected_source_count,effective_from)
values ('10000000-0000-0000-0000-000000000001','builder-fixture',1,'supplier-first-matched-relative-v1',4,'2026-07-01');
insert into public.market_index_cohort_sources(cohort_id,source,carry_forward_ttl,source_weight)
select '10000000-0000-0000-0000-000000000001',s,interval '3 days',1
from unnest(array['a','b','c','d']) s;
insert into public.coffee_catalog(name) select 'fixture-'||g from generate_series(1,40) g;

-- Supplier capture leases are exclusive, expiring, and owner-released.
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values
  ('01000000-0000-0000-0000-000000000001','fixture-one',1,1),
  ('01000000-0000-0000-0000-000000000002','fixture-two',1,1);
do $$ begin
  if not public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001') then
    raise exception 'first lease acquisition failed'; end if;
  if public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002') then
    raise exception 'live lease was stolen by another run'; end if;
  if public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002') then
    raise exception 'non-owner released a live lease'; end if;
  if not public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001',interval '1 hour') then
    raise exception 'owner could not renew its lease'; end if;
end $$;
update public.supplier_scrape_leases
set acquired_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour'
where source='a';
do $$ begin
  if not public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002') then
    raise exception 'expired lease could not be taken over'; end if;
  if public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001') then
    raise exception 'former owner released replacement lease'; end if;
  if not public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002') then
    raise exception 'current owner could not release lease'; end if;
end $$;
update public.scrape_runs set status='succeeded',completed_at=clock_timestamp()
where id='01000000-0000-0000-0000-000000000001';
do $$ begin
  perform public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001');
  raise exception 'completed run acquired a supplier lease';
exception when raise_exception then
  if sqlerrm <> 'supplier scrape leases require a running scrape run' then raise; end if;
end $$;

-- Complete day-one sets. Source a has ten items but must have only one supplier vote.
insert into public.supplier_observation_sets(id,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values
 ('11000000-0000-0000-0000-000000000001','a','2026-07-12 10:00Z','partial','known',10,10,10,false),
 ('11000000-0000-0000-0000-000000000002','b','2026-07-12 10:00Z','partial','known',1,1,1,false),
 ('11000000-0000-0000-0000-000000000003','c','2026-07-12 10:00Z','partial','known',1,1,1,false),
 ('11000000-0000-0000-0000-000000000004','d','2026-07-12 10:00Z','partial','known',1,1,1,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '11000000-0000-0000-0000-000000000001',id,'a','2026-07-12 10:00Z',10,true,false,'Colombia'
from public.coffee_catalog order by id limit 10;
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select s.set_id,c.id,s.source,'2026-07-12 10:00Z',s.price,true,false,'Colombia'
from (values
 ('11000000-0000-0000-0000-000000000002'::uuid,'b',30::numeric,11),
 ('11000000-0000-0000-0000-000000000003'::uuid,'c',20::numeric,12),
 ('11000000-0000-0000-0000-000000000004'::uuid,'d',20::numeric,13)
) s(set_id,source,price,n) join lateral (select id from public.coffee_catalog order by id offset s.n-1 limit 1) c on true;
update public.supplier_observation_sets set status='complete',is_complete=true where id::text like '11000000-%';

do $$ declare r record; v numeric; begin
  select * into r from public.build_market_publication('2026-07-12','builder-fixture',1);
  if r.action <> 'activated' or r.quality_tier <> 'healthy' then raise exception 'day one was not healthy/active: %',r; end if;
  select price_avg into v from public.market_publication_price_indexes where publication_id=r.publication_id and origin='Colombia';
  if v <> 20 then raise exception 'supplier-first average expected 20, got %',v; end if;
  if (select sample_size from public.market_publication_price_indexes where publication_id=r.publication_id and origin='Colombia') <> 13 then
    raise exception 'raw sample size was not retained';
  end if;
end $$;

-- Three fresh day-two sets and one bounded carry. A forged partial newer set is ineligible.
insert into public.supplier_observation_sets(id,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values
 ('12000000-0000-0000-0000-000000000001','a','2026-07-13 10:00Z','partial','known',10,10,10,false),
 ('12000000-0000-0000-0000-000000000002','b','2026-07-13 10:00Z','partial','known',1,1,1,false),
 ('12000000-0000-0000-0000-000000000003','c','2026-07-13 10:00Z','partial','known',1,1,1,false),
 ('12000000-0000-0000-0000-000000000099','d','2026-07-13 23:00Z','partial','known',1,0,0,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '12000000-0000-0000-0000-000000000001',id,'a','2026-07-13 10:00Z',11,true,false,'Colombia'
from public.coffee_catalog order by id limit 10;
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select s.set_id,c.id,s.source,'2026-07-13 10:00Z',s.price,true,false,'Colombia'
from (values
 ('12000000-0000-0000-0000-000000000002'::uuid,'b',33::numeric,21),
 ('12000000-0000-0000-0000-000000000003'::uuid,'c',22::numeric,22)
) s(set_id,source,price,n) join lateral (select id from public.coffee_catalog order by id offset s.n-1 limit 1) c on true;
update public.supplier_observation_sets set status='complete',is_complete=true
where id in ('12000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000002','12000000-0000-0000-0000-000000000003');

do $$ declare r record; v_movement numeric; begin
  select * into r from public.build_market_publication('2026-07-13','builder-fixture',1);
  if r.action <> 'activated' or r.quality_tier <> 'healthy' then raise exception 'fresh+carried candidate failed: %',r; end if;
  if (select freshness from public.market_publication_inputs where publication_id=r.publication_id and source='d') <> 'carried' then
    raise exception 'latest eligible whole set was not carried'; end if;
  if (select stock_confidence from public.market_publication_inputs where publication_id=r.publication_id and source='d') <> 'carried' then
    raise exception 'carried input asserted fresh stock confidence'; end if;
  if (select observed_at from public.supplier_observation_sets where id=(
    select observation_set_id from public.market_publication_inputs where publication_id=r.publication_id and source='d'
  )) <> '2026-07-12 10:00Z' then raise exception 'carry-forward fabricated a new observation time'; end if;
  if not exists (select 1 from public.market_publication_movements where publication_id=r.publication_id
    and movement_status='publishable' and matched_supplier_count=4 and movement_pct is not null) then
    raise exception 'matched-relative movement was not published'; end if;
  select movement_pct into v_movement from public.market_publication_movements
  where publication_id=r.publication_id and origin='Colombia';
  if abs(v_movement - 0.075) > 0.00000001 then
    raise exception 'matched relative should isolate 7.5 percent repricing, got %',v_movement; end if;
end $$;

-- A newer complete d set improves freshness and replaces the entire same-day publication.
insert into public.supplier_observation_sets(id,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values ('12000000-0000-0000-0000-000000000004','d','2026-07-13 12:00Z','partial','known',1,1,1,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '12000000-0000-0000-0000-000000000004',id,'d','2026-07-13 12:00Z',22,true,false,'Colombia'
from public.coffee_catalog order by id offset 22 limit 1;
update public.supplier_observation_sets set status='complete',is_complete=true where id='12000000-0000-0000-0000-000000000004';
do $$ declare r record; v_active integer; v_replaced uuid; v_movement numeric; begin
  select id into v_replaced from public.market_publications
  where as_of_date='2026-07-13' and cohort_id='10000000-0000-0000-0000-000000000001' and status='active';
  select * into r from public.build_market_publication('2026-07-13','builder-fixture',1);
  if r.action <> 'replaced' then raise exception 'better same-day candidate did not replace: %',r; end if;
  select count(*) into v_active from public.market_publications where as_of_date='2026-07-13' and cohort_id='10000000-0000-0000-0000-000000000001' and status='active';
  if v_active <> 1 then raise exception 'whole-publication active invariant failed'; end if;
  if (select status from public.market_publications where id=v_replaced) <> 'rejected' then
    raise exception 'replaced publication was not retired atomically'; end if;
  if (select observation_set_id from public.market_publication_inputs where publication_id=r.publication_id and source='d')
    <> '12000000-0000-0000-0000-000000000004' then raise exception 'replacement did not own the improved whole manifest'; end if;
  select movement_pct into v_movement from public.market_publication_movements
  where publication_id=r.publication_id and origin='Colombia';
  if abs(v_movement - 0.1) > 0.00000001 then
    raise exception 'all-fresh matched relative should report 10 percent repricing, got %',v_movement; end if;
  select * into r from public.build_market_publication('2026-07-13','builder-fixture',1);
  if r.action <> 'rejected_not_better' then raise exception 'equal candidate should be rejected: %',r; end if;
end $$;

-- At day six every prior complete set is outside the three-day TTL; suppress, never activate.
do $$ declare r record; begin
  select * into r from public.build_market_publication('2026-07-18','builder-fixture',1);
  if r.action <> 'suppressed' or r.quality_tier <> 'suppressed' then raise exception 'TTL expiry did not suppress: %',r; end if;
  if exists(select 1 from public.market_publications where id=r.publication_id and status='active') then raise exception 'suppressed candidate activated'; end if;
  if (select count(*) from public.market_publication_source_evidence where publication_id=r.publication_id and selection_state='expired') <> 4 then
    raise exception 'expired suppliers were not disclosed individually'; end if;
  if (select count(*) from public.market_publications where cohort_id='10000000-0000-0000-0000-000000000001' and status='active') <> 2 then
    raise exception 'suppression should preserve prior active publication dates'; end if;
end $$;

-- Frozen expected denominators must agree with enabled cohort membership.
insert into public.market_index_cohorts(id,cohort_key,version,methodology_version,expected_source_count,effective_from)
values ('10000000-0000-0000-0000-000000000002','invalid-fixture',1,'v1',2,'2026-07-01');
insert into public.market_index_cohort_sources(cohort_id,source)
values ('10000000-0000-0000-0000-000000000002','only-one');
do $$ begin
  perform public.build_market_publication('2026-07-13','invalid-fixture',1);
  raise exception 'builder accepted mismatched expected cohort membership';
exception when raise_exception then
  if sqlerrm not like 'Cohort expected_source_count%does not match enabled membership%' then raise; end if;
end $$;

do $$ begin
  update public.market_publication_quality_policies
  set healthy_supplier_coverage=0.81 where policy_version='coverage-v1';
  raise exception 'referenced policy was mutable';
exception when raise_exception then
  if sqlerrm <> 'Referenced market publication policy is immutable; create a new policy version' then raise; end if;
end $$;

do $$ begin
  if has_function_privilege('anon','public.build_market_publication(date,text,integer)','execute')
    or has_function_privilege('authenticated','public.build_market_publication(date,text,integer)','execute')
    or not has_function_privilege('service_role','public.build_market_publication(date,text,integer)','execute')
    or has_function_privilege('anon','public.acquire_supplier_scrape_lease(text,uuid,interval)','execute')
    or has_function_privilege('authenticated','public.release_supplier_scrape_lease(text,uuid)','execute')
    or not has_function_privilege('service_role','public.acquire_supplier_scrape_lease(text,uuid,interval)','execute')
    or not has_function_privilege('service_role','public.release_supplier_scrape_lease(text,uuid)','execute') then
    raise exception 'builder RPC grants are not service-role-only';
  end if;
end $$;

rollback;

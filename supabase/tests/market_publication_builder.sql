-- Executable behavior contract. Run after foundation + builder migrations in a disposable DB.
begin;

insert into public.market_index_cohorts(id,cohort_key,version,methodology_version,expected_source_count,effective_from)
values ('10000000-0000-0000-0000-000000000001','builder-fixture',1,'supplier-first-matched-relative-v1',4,'2026-07-01');
insert into public.market_index_cohort_sources(cohort_id,source,carry_forward_ttl,source_weight)
select '10000000-0000-0000-0000-000000000001',s,interval '3 days',1
from unnest(array['a','b','c','d']) s;
insert into public.coffee_catalog(name) select 'fixture-'||g from generate_series(1,40) g;

do $$ begin
  insert into public.supplier_observation_sets(id,source,observed_at,status,completeness,
    expected_item_count,observed_item_count,snapshot_item_count,is_complete)
  values ('00000000-0000-0000-0000-000000000099','direct-complete','2026-07-12 08:00Z',
    'complete','known',0,0,0,true);
  raise exception 'known observation set bypassed open-then-fenced lifecycle';
exception when raise_exception then
  if sqlerrm <> 'Known observation sets must be inserted open and completed by a fenced lifecycle update' then raise; end if;
end $$;
insert into public.supplier_observation_sets(id,source,observed_at,status,completeness,
  observed_item_count,snapshot_item_count,is_complete)
values ('00000000-0000-0000-0000-000000000098','legacy-fixture','2026-07-12 08:00Z',
  'legacy','legacy',0,0,true);

-- Supplier capture leases are exclusive, expiring, and owner-released.
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values
  ('01000000-0000-0000-0000-000000000001','fixture-one',1,1),
  ('01000000-0000-0000-0000-000000000002','fixture-two',1,1);
do $$ declare v_fence bigint; begin
  v_fence := public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001');
  if v_fence is null then
    raise exception 'first lease acquisition failed'; end if;
  if public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002') is not null then
    raise exception 'live lease was stolen by another run'; end if;
  if public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002',v_fence) then
    raise exception 'non-owner released a live lease'; end if;
  if public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001',interval '1 hour') <> v_fence then
    raise exception 'owner could not renew its lease'; end if;
end $$;
update public.supplier_scrape_leases
set acquired_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour'
where source='a';
do $$ declare v_old_fence bigint; v_new_fence bigint; begin
  select fence into v_old_fence from public.supplier_scrape_leases where source='a';
  v_new_fence := public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002');
  if v_new_fence is null or v_new_fence <= v_old_fence then
    raise exception 'expired lease could not be taken over'; end if;
  begin
    insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,
      completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
    values ('01000000-0000-0000-0000-000000000099','01000000-0000-0000-0000-000000000001',v_old_fence,
      'a','2026-07-12 09:00Z','partial','known',0,0,0,false);
    update public.supplier_observation_sets set status='complete',is_complete=true
    where id='01000000-0000-0000-0000-000000000099';
    raise exception 'stale lease fence completed an observation set';
  exception when raise_exception then
    if sqlerrm <> 'Completing an observation set requires its live fenced supplier lease' then raise; end if;
  end;
  if public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000001',v_old_fence) then
    raise exception 'former owner released replacement lease'; end if;
  if not public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000002',v_new_fence) then
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
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values ('01000000-0000-0000-0000-000000000003','observation-fixtures-day-one',5,5);
create temporary table _fixture_fences(source text primary key,fence bigint not null) on commit drop;
insert into _fixture_fences(source,fence)
select source,public.acquire_supplier_scrape_lease(source,'01000000-0000-0000-0000-000000000003')
from unnest(array['a','b','c','d','seal-test']) source;

insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,
  completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values ('12000000-0000-0000-0000-000000000098','01000000-0000-0000-0000-000000000003',
  (select fence from _fixture_fences where source='seal-test'),'seal-test','2026-07-13 22:00Z','partial','known',1,1,1,false);
alter table public.coffee_price_observations disable trigger guard_complete_observations;
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,origin)
select '12000000-0000-0000-0000-000000000098',max(id),'seal-test','2026-07-14 22:00Z',99,true,'Colombia'
from public.coffee_catalog;
alter table public.coffee_price_observations enable trigger guard_complete_observations;
do $$ begin
  update public.supplier_observation_sets set status='complete',is_complete=true
  where id='12000000-0000-0000-0000-000000000098';
  raise exception 'set sealing accepted a mismatched future child timestamp';
exception when raise_exception then
  if sqlerrm <> 'Observation set contains a child with a mismatched observation timestamp' then raise; end if;
end $$;

-- Complete day-one sets. Source a has ten items but must have only one supplier vote.
insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values
 ('11000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000003',(select fence from _fixture_fences where source='a'),'a','2026-07-12 10:00Z','partial','known',10,10,10,false),
 ('11000000-0000-0000-0000-000000000002','01000000-0000-0000-0000-000000000003',(select fence from _fixture_fences where source='b'),'b','2026-07-12 10:00Z','partial','known',1,1,1,false),
 ('11000000-0000-0000-0000-000000000003','01000000-0000-0000-0000-000000000003',(select fence from _fixture_fences where source='c'),'c','2026-07-12 10:00Z','partial','known',1,1,1,false),
 ('11000000-0000-0000-0000-000000000004','01000000-0000-0000-0000-000000000003',(select fence from _fixture_fences where source='d'),'d','2026-07-12 10:00Z','partial','known',1,1,1,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '11000000-0000-0000-0000-000000000001',id,'a','2026-07-12 10:00Z',10,true,false,'Colombia'
from public.coffee_catalog order by id limit 10;
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select s.set_id,c.id,s.source,'2026-07-12 10:00Z',s.price,true,false,s.origin
from (values
 ('11000000-0000-0000-0000-000000000002'::uuid,'b',30::numeric,11,'Colombia'),
 ('11000000-0000-0000-0000-000000000003'::uuid,'c',20::numeric,12,'Colombia'),
 ('11000000-0000-0000-0000-000000000004'::uuid,'d',20::numeric,13,'Peru')
) s(set_id,source,price,n,origin) join lateral (select id from public.coffee_catalog order by id offset s.n-1 limit 1) c on true;
update public.coffee_price_observations set stocked=null
where observation_set_id='11000000-0000-0000-0000-000000000001'
  and catalog_id=(select min(catalog_id) from public.coffee_price_observations where observation_set_id='11000000-0000-0000-0000-000000000001');
update public.supplier_observation_sets set status='complete',is_complete=true where id::text like '11000000-%';

do $$ declare r record; v numeric; begin
  select * into r from public.build_market_publication('2026-07-12','builder-fixture',1);
  if r.action <> 'activated' or r.quality_tier <> 'healthy' then raise exception 'day one was not healthy/active: %',r; end if;
  select price_avg into v from public.market_publication_price_indexes where publication_id=r.publication_id and origin='Colombia';
  if v <> 20 then raise exception 'supplier-first average expected 20, got %',v; end if;
  if (select sample_size from public.market_publication_price_indexes where publication_id=r.publication_id and origin='Colombia') <> 11 then
    raise exception 'unknown stock was not excluded while true-stock samples were retained';
  end if;
end $$;

select public.release_supplier_scrape_lease(source,'01000000-0000-0000-0000-000000000003',fence)
from _fixture_fences where source in ('a','b','c','d');
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values ('01000000-0000-0000-0000-000000000004','observation-fixtures-day-two',4,4);
create temporary table _day2_fences(source text primary key,fence bigint not null) on commit drop;
insert into _day2_fences(source,fence)
select source,public.acquire_supplier_scrape_lease(source,'01000000-0000-0000-0000-000000000004')
from unnest(array['a','b','c','d']) source;

-- Three fresh day-two sets and one bounded carry. A forged partial newer set is ineligible.
insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values
 ('12000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000004',(select fence from _day2_fences where source='a'),'a','2026-07-13 10:00Z','partial','known',10,10,10,false),
 ('12000000-0000-0000-0000-000000000002','01000000-0000-0000-0000-000000000004',(select fence from _day2_fences where source='b'),'b','2026-07-13 10:00Z','partial','known',1,1,1,false),
 ('12000000-0000-0000-0000-000000000003','01000000-0000-0000-0000-000000000004',(select fence from _day2_fences where source='c'),'c','2026-07-13 10:00Z','partial','known',1,1,1,false),
 ('12000000-0000-0000-0000-000000000099','01000000-0000-0000-0000-000000000004',(select fence from _day2_fences where source='d'),'d','2026-07-13 23:00Z','partial','known',1,0,0,false);
do $$ begin
  insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,origin)
  select '12000000-0000-0000-0000-000000000099',max(id),'d','2026-07-12 23:00Z',99,true,'Colombia'
  from public.coffee_catalog;
  raise exception 'mismatched child observation timestamp was accepted';
exception when raise_exception then
  if sqlerrm <> 'Observation timestamp must equal its supplier observation set timestamp' then raise; end if;
end $$;
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
    and movement_status='publishable' and matched_supplier_count=3 and movement_pct is not null) then
    raise exception 'matched-relative movement was not published'; end if;
  select movement_pct into v_movement from public.market_publication_movements
  where publication_id=r.publication_id and origin='Colombia';
  if abs(v_movement - 0.1) > 0.00000001 then
    raise exception 'matched relative should isolate 10 percent repricing, got %',v_movement; end if;
end $$;

-- A newer complete d set improves freshness and replaces the entire same-day publication.
select public.release_supplier_scrape_lease('d','01000000-0000-0000-0000-000000000004',
  (select fence from _day2_fences where source='d'));
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values ('01000000-0000-0000-0000-000000000005','observation-fixtures-day-two-d-retry',1,1);
create temporary table _day2_d_retry_fence(fence bigint not null) on commit drop;
insert into _day2_d_retry_fence values (
  (public.acquire_supplier_scrape_lease('d','01000000-0000-0000-0000-000000000005'))
);
insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values ('12000000-0000-0000-0000-000000000004','01000000-0000-0000-0000-000000000005',(select fence from _day2_d_retry_fence),'d','2026-07-13 12:00Z','partial','known',1,1,1,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '12000000-0000-0000-0000-000000000004',id,'d','2026-07-13 12:00Z',44,true,false,'Colombia'
from public.coffee_catalog order by id offset 22 limit 1;
update public.supplier_observation_sets set status='complete',is_complete=true where id='12000000-0000-0000-0000-000000000004';
do $$ declare r record; v_active integer; v_replaced uuid; v_movement numeric; v_total numeric; v_assortment numeric; begin
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
  select total_price_relative,assortment_shift_pct into v_total,v_assortment
  from public.market_publication_movements where publication_id=r.publication_id and origin='Colombia';
  if abs(v_total - 1.375) > 0.00000001 or abs(v_assortment - 0.25) > 0.00000001 then
    raise exception 'entrant decomposition was wrong: total %, assortment %',v_total,v_assortment; end if;
  select * into r from public.build_market_publication('2026-07-13','builder-fixture',1);
  if r.action <> 'rejected_not_better' then raise exception 'equal candidate should be rejected: %',r; end if;
end $$;

-- A later overlapping policy wins by effective_from without rewriting v1.
insert into public.market_publication_quality_policies (
  policy_version,effective_from,expected_item_lookback,
  healthy_supplier_coverage,healthy_item_coverage,healthy_max_stale_share,
  degraded_supplier_coverage,degraded_item_coverage,degraded_max_stale_share,
  supplier_coverage_weight,item_coverage_weight,freshness_weight
) values ('coverage-v2','2026-07-14',interval '30 days',0.80,0.70,0.20,0.60,0.50,0.40,0.45,0.35,0.20);

-- Day three removes low-priced c from Colombia while a, b, and d remain.
-- Two-sided decomposition must report zero matched repricing and isolate the
-- departure as assortment movement.
select public.release_supplier_scrape_lease(source,'01000000-0000-0000-0000-000000000004',fence)
from _day2_fences where source in ('a','b','c');
select public.release_supplier_scrape_lease('d','01000000-0000-0000-0000-000000000005',
  (select fence from _day2_d_retry_fence));
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values ('01000000-0000-0000-0000-000000000006','observation-fixtures-day-three',4,4);
create temporary table _day3_fences(source text primary key,fence bigint not null) on commit drop;
insert into _day3_fences(source,fence)
select source,public.acquire_supplier_scrape_lease(source,'01000000-0000-0000-0000-000000000006')
from unnest(array['a','b','c','d']) source;
insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values
 ('13000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000006',(select fence from _day3_fences where source='a'),'a','2026-07-14 10:00Z','partial','known',10,10,10,false),
 ('13000000-0000-0000-0000-000000000002','01000000-0000-0000-0000-000000000006',(select fence from _day3_fences where source='b'),'b','2026-07-14 10:00Z','partial','known',1,1,1,false),
 ('13000000-0000-0000-0000-000000000003','01000000-0000-0000-0000-000000000006',(select fence from _day3_fences where source='c'),'c','2026-07-14 10:00Z','partial','known',1,1,1,false),
 ('13000000-0000-0000-0000-000000000004','01000000-0000-0000-0000-000000000006',(select fence from _day3_fences where source='d'),'d','2026-07-14 10:00Z','partial','known',1,1,1,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '13000000-0000-0000-0000-000000000001',id,'a','2026-07-14 10:00Z',11,true,false,'Colombia'
from public.coffee_catalog order by id limit 10;
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select s.set_id,catalog.id,s.source,'2026-07-14 10:00Z',s.price,true,false,s.origin
from (values
 ('13000000-0000-0000-0000-000000000002'::uuid,'b',33::numeric,24,'Colombia'),
 ('13000000-0000-0000-0000-000000000003'::uuid,'c',40::numeric,25,'Peru'),
 ('13000000-0000-0000-0000-000000000004'::uuid,'d',44::numeric,26,'Colombia')
) s(set_id,source,price,n,origin)
join lateral (select id from public.coffee_catalog order by id offset s.n-1 limit 1) catalog on true;
update public.supplier_observation_sets set status='complete',is_complete=true where id::text like '13000000-%';
do $$ declare r record; v_total numeric; v_repricing numeric; v_assortment numeric; begin
  select * into r from public.build_market_publication('2026-07-14','builder-fixture',1);
  if r.action <> 'activated' then raise exception 'day-three publication did not activate: %',r; end if;
  if (select policy_version from public.market_publications where id=r.publication_id) <> 'coverage-v2' then
    raise exception 'latest effective quality policy was not selected'; end if;
  if (select predecessor_publication_id from public.market_publications where id=r.publication_id) is distinct from (
    select id from public.market_publications where cohort_id='10000000-0000-0000-0000-000000000001'
      and as_of_date='2026-07-13' and status='active'
  ) then raise exception 'publication predecessor chain was not recorded'; end if;
  select total_price_relative,movement_pct,assortment_shift_pct into v_total,v_repricing,v_assortment
  from public.market_publication_movements where publication_id=r.publication_id and origin='Colombia';
  if abs(v_total-(29.3333333333333333/27.5)) > 0.00000001
    or abs(v_repricing) > 0.00000001
    or abs(v_assortment-(29.3333333333333333/27.5-1)) > 0.00000001 then
    raise exception 'departure decomposition was wrong: total %, repricing %, assortment %',v_total,v_repricing,v_assortment;
  end if;
end $$;

-- Once a later active publication references day two, day two is finalized.
select public.release_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000006',
  (select fence from _day3_fences where source='a'));
insert into public.scrape_runs(id,command,requested_source_count,selected_source_count)
values ('01000000-0000-0000-0000-000000000007','observation-fixtures-late-day-two-a',1,1);
create temporary table _late_a_fence(fence bigint not null) on commit drop;
insert into _late_a_fence values (
  (public.acquire_supplier_scrape_lease('a','01000000-0000-0000-0000-000000000007'))
);
insert into public.supplier_observation_sets(id,scrape_run_id,lease_fence,source,observed_at,status,completeness,expected_item_count,observed_item_count,snapshot_item_count,is_complete)
values ('12000000-0000-0000-0000-000000000005','01000000-0000-0000-0000-000000000007',
  (select fence from _late_a_fence),'a','2026-07-13 20:00Z','partial','known',10,10,10,false);
insert into public.coffee_price_observations(observation_set_id,catalog_id,source,observed_at,price,stocked,wholesale,origin)
select '12000000-0000-0000-0000-000000000005',id,'a','2026-07-13 20:00Z',12,true,false,'Colombia'
from public.coffee_catalog order by id limit 10;
update public.supplier_observation_sets set status='complete',is_complete=true
where id='12000000-0000-0000-0000-000000000005';
do $$ declare r record; begin
  select * into r from public.build_market_publication('2026-07-13','builder-fixture',1);
  if r.action <> 'rejected_chain_finalized' then
    raise exception 'later predecessor dependency did not finalize day two: %',r; end if;
end $$;

-- At day six every prior complete set is outside the three-day TTL; suppress, never activate.
do $$ declare r record; begin
  select * into r from public.build_market_publication('2026-07-18','builder-fixture',1);
  if r.action <> 'suppressed' or r.quality_tier <> 'suppressed' then raise exception 'TTL expiry did not suppress: %',r; end if;
  if exists(select 1 from public.market_publications where id=r.publication_id and status='active') then raise exception 'suppressed candidate activated'; end if;
  if (select count(*) from public.market_publication_source_evidence where publication_id=r.publication_id and selection_state='expired') <> 4 then
    raise exception 'expired suppliers were not disclosed individually'; end if;
  if (select count(*) from public.market_publications where cohort_id='10000000-0000-0000-0000-000000000001' and status='active') <> 3 then
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
    or has_function_privilege('authenticated','public.release_supplier_scrape_lease(text,uuid,bigint)','execute')
    or not has_function_privilege('service_role','public.acquire_supplier_scrape_lease(text,uuid,interval)','execute')
    or not has_function_privilege('service_role','public.release_supplier_scrape_lease(text,uuid,bigint)','execute') then
    raise exception 'builder RPC grants are not service-role-only';
  end if;
end $$;

rollback;

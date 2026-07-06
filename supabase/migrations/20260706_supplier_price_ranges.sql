-- Supplier price ranges for the analytics "Who has it cheapest?" chart.
--
-- The chart previously reconstructed per-supplier min/median/max from a
-- price-ordered coffee_catalog pull capped at 2,000 rows. That can drop higher
-- priced lots, distort medians, and omit whole suppliers. This RPC computes the
-- aggregate over the full stocked/priced set in Postgres.

create or replace function public.get_supplier_price_ranges()
returns table (
  source text,
  market text,
  lot_count bigint,
  price_min numeric,
  price_median numeric,
  price_max numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with priced as (
    select
      nullif(btrim(source), '') as source,
      wholesale,
      price_per_lb
    from public.coffee_catalog
    where stocked = true
      and price_per_lb is not null
      and price_per_lb > 0
  )
  select
    source,
    'retail'::text as market,
    count(*)::bigint as lot_count,
    min(price_per_lb)::numeric as price_min,
    percentile_cont(0.5) within group (order by price_per_lb)::numeric as price_median,
    max(price_per_lb)::numeric as price_max
  from priced
  where wholesale = false
  group by source

  union all

  select
    source,
    'wholesale'::text as market,
    count(*)::bigint as lot_count,
    min(price_per_lb)::numeric as price_min,
    percentile_cont(0.5) within group (order by price_per_lb)::numeric as price_median,
    max(price_per_lb)::numeric as price_max
  from priced
  where wholesale = true
  group by source

  union all

  select
    source,
    'all'::text as market,
    count(*)::bigint as lot_count,
    min(price_per_lb)::numeric as price_min,
    percentile_cont(0.5) within group (order by price_per_lb)::numeric as price_median,
    max(price_per_lb)::numeric as price_max
  from priced
  group by source;
$$;

comment on function public.get_supplier_price_ranges() is
  'Per-supplier price ranges (min/median/max + lot count) over the full stocked, priced catalog for retail, wholesale, and all scopes. Feeds the analytics SupplierPriceRangeChart.';

revoke execute on function public.get_supplier_price_ranges() from public;
revoke execute on function public.get_supplier_price_ranges() from anon;
revoke execute on function public.get_supplier_price_ranges() from authenticated;
grant execute on function public.get_supplier_price_ranges() to service_role;

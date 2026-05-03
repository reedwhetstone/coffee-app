-- Harden Parchment Intelligence price-index API contract.
-- Adds the aggregate columns used by /v1/price-index and removes direct public
-- table access so entitlement checks cannot be bypassed with the anon key.

ALTER TABLE public.price_index_snapshots
  ADD COLUMN IF NOT EXISTS price_p25 numeric(10, 2),
  ADD COLUMN IF NOT EXISTS price_p75 numeric(10, 2),
  ADD COLUMN IF NOT EXISTS price_stdev numeric(10, 2),
  ADD COLUMN IF NOT EXISTS aggregation_tier integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.price_index_snapshots.price_p25 IS
  '25th percentile price per pound for the aggregate segment.';
COMMENT ON COLUMN public.price_index_snapshots.price_p75 IS
  '75th percentile price per pound for the aggregate segment.';
COMMENT ON COLUMN public.price_index_snapshots.price_stdev IS
  'Population standard deviation of price per pound for the aggregate segment.';
COMMENT ON COLUMN public.price_index_snapshots.aggregation_tier IS
  'Aggregation privacy tier. Tier 1 is safe for public analytics and API aggregate output.';

DROP POLICY IF EXISTS "Public read price_index_snapshots" ON public.price_index_snapshots;
REVOKE SELECT ON public.price_index_snapshots FROM anon, authenticated;
GRANT ALL ON public.price_index_snapshots TO service_role;

DROP FUNCTION IF EXISTS public.compute_price_index(date);

CREATE OR REPLACE FUNCTION public.compute_price_index(p_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  WITH raw AS (
    SELECT
      ps.catalog_id,
      ps.cost_lb,
      ps.stocked,
      ps.wholesale,
      cc.country AS origin,
      cc.processing AS process,
      cc.grade,
      cc.source
    FROM public.coffee_price_snapshots ps
    JOIN public.coffee_catalog cc ON cc.id = ps.catalog_id
    WHERE ps.snapshot_date = p_date
      AND ps.stocked = true
      AND ps.cost_lb IS NOT NULL
      AND ps.cost_lb > 0
  ),
  agg AS (
    SELECT
      origin,
      process,
      grade,
      (wholesale = true) AS wholesale_only,
      COUNT(DISTINCT source)::int AS supplier_count,
      MIN(cost_lb)::numeric AS price_min,
      MAX(cost_lb)::numeric AS price_max,
      AVG(cost_lb)::numeric AS price_avg,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_lb)::numeric AS price_median,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cost_lb)::numeric AS price_p25,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cost_lb)::numeric AS price_p75,
      STDDEV_POP(cost_lb)::numeric AS price_stdev,
      COUNT(*)::int AS sample_size,
      1::int AS aggregation_tier
    FROM raw
    WHERE origin IS NOT NULL
    GROUP BY origin, process, grade, (wholesale = true)
    HAVING COUNT(*) >= 2
  )
  INSERT INTO public.price_index_snapshots (
    snapshot_date,
    origin,
    process,
    grade,
    supplier_count,
    price_min,
    price_max,
    price_avg,
    price_median,
    price_p25,
    price_p75,
    price_stdev,
    sample_size,
    wholesale_only,
    aggregation_tier
  )
  SELECT
    p_date,
    origin,
    process,
    grade,
    supplier_count,
    ROUND(price_min, 2),
    ROUND(price_max, 2),
    ROUND(price_avg, 2),
    ROUND(price_median, 2),
    ROUND(price_p25, 2),
    ROUND(price_p75, 2),
    ROUND(price_stdev, 2),
    sample_size,
    wholesale_only,
    aggregation_tier
  FROM agg
  ON CONFLICT (snapshot_date, origin, COALESCE(process, ''), COALESCE(grade, ''), wholesale_only)
  DO UPDATE SET
    supplier_count   = EXCLUDED.supplier_count,
    price_min        = EXCLUDED.price_min,
    price_max        = EXCLUDED.price_max,
    price_avg        = EXCLUDED.price_avg,
    price_median     = EXCLUDED.price_median,
    price_p25        = EXCLUDED.price_p25,
    price_p75        = EXCLUDED.price_p75,
    price_stdev      = EXCLUDED.price_stdev,
    sample_size      = EXCLUDED.sample_size,
    aggregation_tier = EXCLUDED.aggregation_tier,
    created_at       = now();
END;
$$;

COMMENT ON FUNCTION public.compute_price_index(date) IS
  'Aggregates daily price data from coffee_price_snapshots into price_index_snapshots, including percentile and dispersion fields used by /v1/price-index. Normalization happens at scraper ingest.';

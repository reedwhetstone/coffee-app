-- ============================================================
-- FIX: Remove origin_aliases/process_aliases references from compute_price_index
-- Date: 2026-03-22
-- Issue: Function referenced tables that don't exist (origin_aliases, process_aliases)
-- Fix: Use catalog columns directly (normalization happens at scraper ingest time)
-- ============================================================

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
      COUNT(DISTINCT source) AS supplier_count,
      MIN(cost_lb) AS price_min,
      MAX(cost_lb) AS price_max,
      AVG(cost_lb) AS price_avg,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_lb) AS price_median,
      COUNT(*) AS sample_size
    FROM raw
    WHERE origin IS NOT NULL
    GROUP BY origin, process, grade, (wholesale = true)
    HAVING COUNT(*) >= 2
  )
  INSERT INTO public.price_index_snapshots (
    snapshot_date, origin, process, grade,
    supplier_count, price_min, price_max, price_avg, price_median,
    sample_size, wholesale_only
  )
  SELECT
    p_date, origin, process, grade,
    supplier_count, price_min, price_max, price_avg, price_median,
    sample_size, wholesale_only
  FROM agg
  ON CONFLICT (snapshot_date, origin, COALESCE(process, ''), COALESCE(grade, ''), wholesale_only)
  DO UPDATE SET
    supplier_count = EXCLUDED.supplier_count,
    price_min      = EXCLUDED.price_min,
    price_max      = EXCLUDED.price_max,
    price_avg      = EXCLUDED.price_avg,
    price_median   = EXCLUDED.price_median,
    sample_size    = EXCLUDED.sample_size;
END;
$$;

COMMENT ON FUNCTION public.compute_price_index(date) IS
  'Aggregates daily price data from coffee_price_snapshots into price_index_snapshots. '
  'Normalization done at scraper ingest (normalizeOrigin/normalizeProcessing in dataValidators.ts).';

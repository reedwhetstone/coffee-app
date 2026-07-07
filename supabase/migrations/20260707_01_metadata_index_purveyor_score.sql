-- Replace Market Metadata score snapshots with Purveyor Score snapshots.
--
-- The original metadata index used coffee_catalog.score_value for dimension='score'.
-- score_value is supplier-provided and not comparable across suppliers. The Market
-- Metadata surface must use Purveyor Score, the Purveyors-owned listing intelligence
-- score, plus its tier and confidence companion fields.

DELETE FROM public.metadata_index_snapshots
WHERE dimension = 'score';

ALTER TABLE public.metadata_index_snapshots
  DROP CONSTRAINT IF EXISTS metadata_index_snapshots_dimension_check;

ALTER TABLE public.metadata_index_snapshots
  ADD CONSTRAINT metadata_index_snapshots_dimension_check
  CHECK (
    dimension IN (
      'process',
      'disclosure',
      'purveyor_score',
      'purveyor_score_confidence',
      'purveyor_score_tier'
    )
  );

COMMENT ON TABLE public.metadata_index_snapshots IS
  'Metadata-trend index (ADR-008 §4.2): process-mix, disclosure-level, Purveyor Score, Purveyor Score confidence, and Purveyor Score tier trends over time. '
  'One row per (period_start, grain, origin|market-wide, market, dimension, bucket). '
  'Written by compute_metadata_index() (backfillable to 2026-03-21); read by /v1/market/metadata-index. '
  'PREMIUM: service-role read only — the public process-mix slice is exposed only through the API entitlement layer.';
COMMENT ON COLUMN public.metadata_index_snapshots.share IS
  'Mean-of-daily-shares over the period. NULL for percentile dimensions purveyor_score and purveyor_score_confidence.';
COMMENT ON COLUMN public.metadata_index_snapshots.stat_value IS
  'Percentile value for purveyor_score and purveyor_score_confidence buckets (p25|p50|p75). NULL for categorical dimensions.';

DROP FUNCTION IF EXISTS public.compute_metadata_index(date);
CREATE OR REPLACE FUNCTION public.compute_metadata_index(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (out_grain text, out_rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_min_origin_lots int := 5;
BEGIN
  CREATE TEMP TABLE tmp_periods ON COMMIT DROP AS
  SELECT 'week'::text  AS grain, date_trunc('week',  p_date)::date AS period_start
  UNION ALL
  SELECT 'month'::text AS grain, date_trunc('month', p_date)::date AS period_start;

  DELETE FROM public.metadata_index_snapshots m
  USING tmp_periods tp
  WHERE m.grain = tp.grain AND m.period_start = tp.period_start;

  -- Per-date lot rows for every affected period, expanded across market scope
  -- ('all' + retail|wholesale) and origin scope (market-wide NULL + own origin).
  CREATE TEMP TABLE tmp_lots ON COMMIT DROP AS
  SELECT
    tp.grain, tp.period_start, ps.snapshot_date,
    ms.market AS market, os.origin AS origin,
    ps.catalog_id, cc.source,
    COALESCE(cc.processing_base_method, 'undisclosed')      AS process_bucket,
    COALESCE(cc.processing_disclosure_level, 'undisclosed') AS disclosure_bucket,
    COALESCE(NULLIF(cc.purveyor_score_tier, ''), 'Unscored') AS purveyor_score_tier_bucket,
    cc.purveyor_score::numeric                              AS purveyor_score,
    cc.purveyor_score_confidence::numeric                   AS purveyor_score_confidence
  FROM tmp_periods tp
  JOIN public.coffee_price_snapshots ps
    ON ps.snapshot_date >= tp.period_start
   AND ps.snapshot_date < (CASE tp.grain
        WHEN 'week' THEN tp.period_start + 7
        ELSE (tp.period_start + interval '1 month')::date END)
   AND ps.stocked = true AND ps.cost_lb IS NOT NULL AND ps.cost_lb > 0
  JOIN public.coffee_catalog cc ON cc.id = ps.catalog_id
  CROSS JOIN LATERAL (
    VALUES ('all'::text), (CASE WHEN ps.wholesale THEN 'wholesale' ELSE 'retail' END)
  ) AS ms(market)
  CROSS JOIN LATERAL (
    SELECT NULL::text AS origin
    UNION ALL
    SELECT cc.country WHERE cc.country IS NOT NULL
  ) AS os;

  CREATE TEMP TABLE tmp_daily_totals ON COMMIT DROP AS
  SELECT grain, period_start, market, origin, snapshot_date, count(*) AS day_total_lots
  FROM tmp_lots
  GROUP BY grain, period_start, market, origin, snapshot_date;

  CREATE TEMP TABLE tmp_kept_groups ON COMMIT DROP AS
  SELECT grain, period_start, market, origin
  FROM tmp_daily_totals
  GROUP BY grain, period_start, market, origin
  HAVING origin IS NULL OR avg(day_total_lots) >= v_min_origin_lots;

  CREATE TEMP TABLE tmp_purveyor_score_daily_totals ON COMMIT DROP AS
  SELECT grain, period_start, market, origin, snapshot_date,
         count(*) FILTER (WHERE purveyor_score IS NOT NULL) AS day_scored_lots,
         count(*) FILTER (WHERE purveyor_score_confidence IS NOT NULL) AS day_confidence_lots
  FROM tmp_lots
  GROUP BY grain, period_start, market, origin, snapshot_date;

  CREATE TEMP TABLE tmp_kept_purveyor_score_groups ON COMMIT DROP AS
  SELECT grain, period_start, market, origin
  FROM tmp_purveyor_score_daily_totals
  GROUP BY grain, period_start, market, origin
  HAVING origin IS NULL OR avg(day_scored_lots) >= v_min_origin_lots;

  CREATE TEMP TABLE tmp_kept_purveyor_confidence_groups ON COMMIT DROP AS
  SELECT grain, period_start, market, origin
  FROM tmp_purveyor_score_daily_totals
  GROUP BY grain, period_start, market, origin
  HAVING origin IS NULL OR avg(day_confidence_lots) >= v_min_origin_lots;

  -- ---------- process + disclosure + Purveyor Score tier (share-based) ----------
  INSERT INTO public.metadata_index_snapshots
    (period_start, grain, origin, market, dimension, bucket, lot_count, share, stat_value, supplier_count)
  WITH day_bucket AS (
    SELECT
      l.grain, l.period_start, l.market, l.origin, l.snapshot_date, dim.dimension,
      CASE dim.dimension
        WHEN 'process' THEN l.process_bucket
        WHEN 'disclosure' THEN l.disclosure_bucket
        ELSE l.purveyor_score_tier_bucket
      END AS bucket,
      count(*) AS day_bucket_lots,
      count(DISTINCT l.source) AS day_bucket_suppliers
    FROM tmp_lots l
    CROSS JOIN (VALUES ('process'), ('disclosure'), ('purveyor_score_tier')) AS dim(dimension)
    GROUP BY l.grain, l.period_start, l.market, l.origin, l.snapshot_date, dim.dimension,
      CASE dim.dimension
        WHEN 'process' THEN l.process_bucket
        WHEN 'disclosure' THEN l.disclosure_bucket
        ELSE l.purveyor_score_tier_bucket
      END
  ),
  buckets AS (
    SELECT DISTINCT grain, period_start, market, origin, dimension, bucket
    FROM day_bucket
  ),
  grid AS (
    SELECT
      t.grain, t.period_start, t.market, t.origin, t.snapshot_date, t.day_total_lots,
      b.dimension, b.bucket,
      COALESCE(dbk.day_bucket_lots, 0)      AS day_bucket_lots,
      COALESCE(dbk.day_bucket_suppliers, 0) AS day_bucket_suppliers
    FROM tmp_daily_totals t
    JOIN buckets b
      ON b.grain = t.grain AND b.period_start = t.period_start
     AND b.market = t.market AND b.origin IS NOT DISTINCT FROM t.origin
    LEFT JOIN day_bucket dbk
      ON dbk.grain = t.grain AND dbk.period_start = t.period_start
     AND dbk.market = t.market AND dbk.origin IS NOT DISTINCT FROM t.origin
     AND dbk.snapshot_date = t.snapshot_date
     AND dbk.dimension = b.dimension AND dbk.bucket = b.bucket
  )
  SELECT
    g.period_start, g.grain, g.origin, g.market, grid.dimension, grid.bucket,
    round(avg(grid.day_bucket_lots))::int                              AS lot_count,
    round(avg(grid.day_bucket_lots::numeric / grid.day_total_lots), 6) AS share,
    NULL::numeric                                                      AS stat_value,
    round(avg(grid.day_bucket_suppliers))::int                         AS supplier_count
  FROM tmp_kept_groups g
  JOIN grid
    ON grid.grain = g.grain AND grid.period_start = g.period_start
   AND grid.market = g.market AND grid.origin IS NOT DISTINCT FROM g.origin
  GROUP BY g.period_start, g.grain, g.origin, g.market, grid.dimension, grid.bucket
  HAVING g.origin IS NULL OR avg(grid.day_bucket_lots) >= v_min_origin_lots;

  -- ---------- Purveyor Score + confidence (percentile-based) ----------
  INSERT INTO public.metadata_index_snapshots
    (period_start, grain, origin, market, dimension, bucket, lot_count, share, stat_value, supplier_count)
  SELECT
    g.period_start, g.grain, g.origin, g.market, 'purveyor_score', pk.bucket,
    round(avg(pk.day_scored_lots))::int      AS lot_count,
    NULL::numeric                            AS share,
    round(avg(pk.pct_value)::numeric, 2)     AS stat_value,
    round(avg(pk.day_scored_suppliers))::int AS supplier_count
  FROM tmp_kept_purveyor_score_groups g
  JOIN (
    SELECT
      s.grain, s.period_start, s.market, s.origin, s.snapshot_date, b.bucket,
      CASE b.bucket
        WHEN 'p25' THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY s.purveyor_score)
        WHEN 'p50' THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY s.purveyor_score)
        ELSE            percentile_cont(0.75) WITHIN GROUP (ORDER BY s.purveyor_score)
      END AS pct_value,
      count(*) AS day_scored_lots,
      count(DISTINCT s.source) AS day_scored_suppliers
    FROM tmp_lots s
    CROSS JOIN (VALUES ('p25'), ('p50'), ('p75')) AS b(bucket)
    WHERE s.purveyor_score IS NOT NULL
    GROUP BY s.grain, s.period_start, s.market, s.origin, s.snapshot_date, b.bucket
  ) pk
    ON pk.grain = g.grain AND pk.period_start = g.period_start
   AND pk.market = g.market AND pk.origin IS NOT DISTINCT FROM g.origin
  GROUP BY g.period_start, g.grain, g.origin, g.market, pk.bucket;

  INSERT INTO public.metadata_index_snapshots
    (period_start, grain, origin, market, dimension, bucket, lot_count, share, stat_value, supplier_count)
  SELECT
    g.period_start, g.grain, g.origin, g.market, 'purveyor_score_confidence', pk.bucket,
    round(avg(pk.day_confidence_lots))::int      AS lot_count,
    NULL::numeric                                AS share,
    round(avg(pk.pct_value)::numeric, 4)         AS stat_value,
    round(avg(pk.day_confidence_suppliers))::int AS supplier_count
  FROM tmp_kept_purveyor_confidence_groups g
  JOIN (
    SELECT
      s.grain, s.period_start, s.market, s.origin, s.snapshot_date, b.bucket,
      CASE b.bucket
        WHEN 'p25' THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY s.purveyor_score_confidence)
        WHEN 'p50' THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY s.purveyor_score_confidence)
        ELSE            percentile_cont(0.75) WITHIN GROUP (ORDER BY s.purveyor_score_confidence)
      END AS pct_value,
      count(*) AS day_confidence_lots,
      count(DISTINCT s.source) AS day_confidence_suppliers
    FROM tmp_lots s
    CROSS JOIN (VALUES ('p25'), ('p50'), ('p75')) AS b(bucket)
    WHERE s.purveyor_score_confidence IS NOT NULL
    GROUP BY s.grain, s.period_start, s.market, s.origin, s.snapshot_date, b.bucket
  ) pk
    ON pk.grain = g.grain AND pk.period_start = g.period_start
   AND pk.market = g.market AND pk.origin IS NOT DISTINCT FROM g.origin
  GROUP BY g.period_start, g.grain, g.origin, g.market, pk.bucket;

  DROP TABLE IF EXISTS tmp_lots;
  DROP TABLE IF EXISTS tmp_daily_totals;
  DROP TABLE IF EXISTS tmp_kept_groups;
  DROP TABLE IF EXISTS tmp_purveyor_score_daily_totals;
  DROP TABLE IF EXISTS tmp_kept_purveyor_score_groups;
  DROP TABLE IF EXISTS tmp_kept_purveyor_confidence_groups;
  DROP TABLE IF EXISTS tmp_periods;

  RETURN QUERY
    SELECT m.grain, count(*)::bigint
    FROM public.metadata_index_snapshots m
    WHERE (m.grain = 'week'  AND m.period_start = date_trunc('week',  p_date)::date)
       OR (m.grain = 'month' AND m.period_start = date_trunc('month', p_date)::date)
    GROUP BY m.grain
    ORDER BY m.grain;
END;
$$;

COMMENT ON FUNCTION public.compute_metadata_index(date) IS
  'Recomputes week+month metadata-index rows for the period containing p_date (§4.2/§4.3). '
  'Mean-of-daily-shares for process, disclosure, and Purveyor Score tier; percentiles for Purveyor Score and Purveyor Score confidence. '
  'Supplier score_value is intentionally not used. Origin groups < 5 mean daily lots suppressed; market-wide always written. '
  'Backfill-safe (idempotent per period/grain). Called by coffee-scraper and the metadata backfill script.';

REVOKE EXECUTE ON FUNCTION public.compute_metadata_index(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_metadata_index(date) TO service_role;

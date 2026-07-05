-- ============================================================
-- MARKET INDEX DECISION SURFACE: Compute RPCs (B-2)
-- Migration: 20260705_02_market_index_compute.sql
-- Date: 2026-07-05
-- Implements: market-index-decision-surface-plan.md §3.2/§3.3/§3.4/§4.3/§4.5
-- Depends on: 20260705_01_market_index_tables.sql
-- Purpose:
--   compute_market_signals(date)                  — §3.2 signal detection + §3.3 evidence
--   compute_metadata_index(date)                  — §4.2/§4.3 metadata-trend index (backfillable)
--   compute_price_move_stats(date, baseline_weeks) — §3.4/§4.5 movement-significance stats
--
-- All heavy math lives here (plpgsql, SECURITY DEFINER) so parchment-api stays a
-- thin reader over the precomputed tables. Every function is idempotent:
-- delete-and-rewrite for the affected date/period.
--
-- Normalization: origin = coffee_catalog.country; process bucket =
-- COALESCE(processing_base_method, 'undisclosed'); market derived from the
-- snapshot wholesale flag (retail = not wholesale). Segment benchmarks and value
-- baselines are computed separately per market so wholesale minimum-tier pricing
-- never pools with retail (§3.2).
--
-- Postgres note: ordered-set aggregates (percentile_cont) and count(DISTINCT ...)
-- cannot be used as window functions, so all segment benchmarks are grouped
-- aggregates joined back to the lot set.
-- ============================================================


-- ============================================================
-- compute_market_signals(p_date)
-- Emits market_signals rows for a single snapshot_date. Signals are a live feed
-- and are NOT backfilled. Idempotent: delete-and-rewrite the day's rows.
-- ============================================================
DROP FUNCTION IF EXISTS public.compute_market_signals(date);
CREATE OR REPLACE FUNCTION public.compute_market_signals(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (signal_type text, rows_written bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_drop_threshold_pct      numeric := 8;    -- price_drop: >= 8% below own trailing median
  v_value_z_threshold       numeric := 1.5;  -- value_quality: >= 1.5 sd above origin+market ratio mean
  v_benchmark_min_lots      int     := 5;    -- segment/scored floor: >= 5 lots
  v_benchmark_min_suppliers int     := 3;    -- segment/scored floor: >= 3 suppliers
BEGIN
  -- Idempotent per date.
  DELETE FROM public.market_signals WHERE snapshot_date = p_date;

  -- Shared current-day lot set (stocked, priced). market from wholesale flag.
  CREATE TEMP TABLE tmp_current_lots ON COMMIT DROP AS
  SELECT
    ps.catalog_id,
    ps.cost_lb                                         AS current_price_lb,
    CASE WHEN ps.wholesale THEN 'wholesale' ELSE 'retail' END AS market,
    cc.country                                         AS origin,
    COALESCE(cc.processing_base_method, 'undisclosed') AS process,
    cc.source                                          AS source,
    cc.score_value                                     AS score_value
  FROM public.coffee_price_snapshots ps
  JOIN public.coffee_catalog cc ON cc.id = ps.catalog_id
  WHERE ps.snapshot_date = p_date
    AND ps.stocked = true
    AND ps.cost_lb IS NOT NULL
    AND ps.cost_lb > 0;

  -- ---------------- price_drop ----------------
  -- Current price >= threshold below the lot's own trailing median over the PRIOR
  -- window [p_date - N, p_date - 1] (>= 2 prior points). Emitted once per qualifying
  -- window (7d/30d independently). Works even when origin IS NULL (own-history based).
  -- History is scoped to the SAME market as the current lot (retail vs wholesale via
  -- the snapshot wholesale flag): a lot that flips wholesale/retail during the lookback
  -- must not pool its retail and wholesale minimum-tier prices into one median, which
  -- would emit a spurious price_drop or hide a real one (§3.2 market separation).
  -- History is also stocked-only (hs.stocked = true), matching the rest of the pipeline:
  -- stale out-of-stock prices must not enter the trailing median or the >= 2-point floor.
  INSERT INTO public.market_signals (
    snapshot_date, signal_type, signal_window, catalog_id, origin, process, market,
    source, score_value, current_price_lb, rank_score, rank_score_input,
    rank_signal_magnitude, evidence
  )
  SELECT
    p_date, 'price_drop', d.signal_window, d.catalog_id, d.origin, d.process, d.market,
    d.source, d.score_value, d.current_price_lb,
    ROUND((abs(d.drop_pct) * (1 + greatest(coalesce(d.score_value, 84) - 84, 0) / 10.0))::numeric, 4),
    'drop_vs_own_median_pct',
    abs(d.drop_pct),
    jsonb_build_object(
      'segment', jsonb_build_object('origin', d.origin, 'process', d.process, 'market', d.market),
      'segment_median', NULL, 'segment_p25', NULL,
      'discount_vs_median_pct', NULL, 'price_percentile_in_segment', NULL,
      'own_trailing_window', d.signal_window,
      'own_trailing_median', d.trailing_median,
      'drop_vs_own_median_pct', d.drop_pct,
      'score_value', d.score_value,
      'value_ratio', NULL, 'origin_market_value_ratio_mean', NULL,
      'origin_market_value_ratio_stddev', NULL, 'value_z_score', NULL,
      'as_of', p_date
    )
  FROM (
    SELECT
      cl.catalog_id, cl.origin, cl.process, cl.market, cl.source, cl.score_value,
      cl.current_price_lb, win.w AS signal_window,
      ROUND(h.trailing_median::numeric, 2) AS trailing_median,
      ROUND(((cl.current_price_lb - h.trailing_median) / h.trailing_median * 100)::numeric, 2) AS drop_pct
    FROM tmp_current_lots cl
    CROSS JOIN (VALUES ('7d', 7), ('30d', 30)) AS win(w, d)
    JOIN LATERAL (
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY hs.cost_lb) AS trailing_median,
        count(*) AS n
      FROM public.coffee_price_snapshots hs
      WHERE hs.catalog_id = cl.catalog_id
        AND hs.snapshot_date BETWEEN p_date - win.d AND p_date - 1
        AND hs.stocked = true
        AND hs.cost_lb IS NOT NULL AND hs.cost_lb > 0
        AND hs.wholesale = (cl.market = 'wholesale')
    ) h ON h.n >= 2 AND h.trailing_median > 0
    WHERE (cl.current_price_lb - h.trailing_median) / h.trailing_median * 100 <= -v_drop_threshold_pct
  ) d;

  -- ---------------- below_market ----------------
  -- Stocked lot priced below its segment (origin, process, market) p25 benchmark.
  -- Segment floor: >= 5 lots from >= 3 suppliers. Suppressed when origin IS NULL.
  -- pct_in_segment is cume_dist over the FULL segment, filtered afterward.
  INSERT INTO public.market_signals (
    snapshot_date, signal_type, signal_window, catalog_id, origin, process, market,
    source, score_value, current_price_lb, rank_score, rank_score_input,
    rank_signal_magnitude, evidence
  )
  SELECT
    p_date, 'below_market', 'n/a', b.catalog_id, b.origin, b.process, b.market,
    b.source, b.score_value, b.current_price_lb,
    ROUND((abs(b.discount_pct) * (1 + greatest(coalesce(b.score_value, 84) - 84, 0) / 10.0))::numeric, 4),
    'discount_vs_median_pct',
    abs(b.discount_pct),
    jsonb_build_object(
      'segment', jsonb_build_object('origin', b.origin, 'process', b.process, 'market', b.market),
      'segment_median', b.seg_median, 'segment_p25', b.seg_p25,
      'discount_vs_median_pct', b.discount_pct,
      'price_percentile_in_segment', b.pct_in_segment,
      'own_trailing_window', NULL, 'own_trailing_median', NULL, 'drop_vs_own_median_pct', NULL,
      'score_value', b.score_value,
      'value_ratio', NULL, 'origin_market_value_ratio_mean', NULL,
      'origin_market_value_ratio_stddev', NULL, 'value_z_score', NULL,
      'as_of', p_date
    )
  FROM (
    SELECT
      r.catalog_id, r.origin, r.process, r.market, r.source, r.score_value, r.current_price_lb,
      ROUND(r.seg_median::numeric, 2) AS seg_median,
      ROUND(r.seg_p25::numeric, 2)    AS seg_p25,
      ROUND(((r.current_price_lb - r.seg_median) / r.seg_median * 100)::numeric, 2) AS discount_pct,
      r.pct_in_segment
    FROM (
      SELECT
        cl.catalog_id, cl.origin, cl.process, cl.market, cl.source, cl.score_value, cl.current_price_lb,
        bench.seg_median, bench.seg_p25,
        ROUND((cume_dist() OVER (PARTITION BY cl.origin, cl.process, cl.market
                                 ORDER BY cl.current_price_lb) * 100)::numeric) AS pct_in_segment
      FROM tmp_current_lots cl
      JOIN (
        SELECT origin, process, market,
               percentile_cont(0.5)  WITHIN GROUP (ORDER BY current_price_lb) AS seg_median,
               percentile_cont(0.25) WITHIN GROUP (ORDER BY current_price_lb) AS seg_p25
        FROM tmp_current_lots
        WHERE origin IS NOT NULL
        GROUP BY origin, process, market
        HAVING count(*) >= v_benchmark_min_lots
           AND count(DISTINCT source) >= v_benchmark_min_suppliers
           AND percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price_lb) > 0
      ) bench
        ON bench.origin = cl.origin AND bench.process = cl.process AND bench.market = cl.market
      WHERE cl.origin IS NOT NULL
    ) r
    WHERE r.current_price_lb < r.seg_p25
  ) b;

  -- ---------------- value_quality ----------------
  -- (score_value / cost_lb) >= threshold sd above the lot's origin+market scored-lot
  -- ratio baseline. Retail/wholesale baselines never pool. Floor: >= 5 scored lots
  -- from >= 3 suppliers, >= 2 distinct positive ratios, stddev > 0. Origin required.
  INSERT INTO public.market_signals (
    snapshot_date, signal_type, signal_window, catalog_id, origin, process, market,
    source, score_value, current_price_lb, rank_score, rank_score_input,
    rank_signal_magnitude, evidence
  )
  SELECT
    p_date, 'value_quality', 'n/a', v.catalog_id, v.origin, v.process, v.market,
    v.source, v.score_value, v.current_price_lb,
    ROUND((v.value_z * (1 + greatest(coalesce(v.score_value, 84) - 84, 0) / 10.0))::numeric, 4),
    'value_z_score',
    v.value_z,
    jsonb_build_object(
      'segment', jsonb_build_object('origin', v.origin, 'process', v.process, 'market', v.market),
      'segment_median', NULL, 'segment_p25', NULL,
      'discount_vs_median_pct', NULL, 'price_percentile_in_segment', NULL,
      'own_trailing_window', NULL, 'own_trailing_median', NULL, 'drop_vs_own_median_pct', NULL,
      'score_value', v.score_value,
      'value_ratio', v.value_ratio,
      'origin_market_value_ratio_mean', v.ratio_mean,
      'origin_market_value_ratio_stddev', v.ratio_stddev,
      'value_z_score', v.value_z,
      'as_of', p_date
    )
  FROM (
    SELECT
      cl.catalog_id, cl.origin, cl.process, cl.market, cl.source, cl.score_value, cl.current_price_lb,
      ROUND((cl.score_value / cl.current_price_lb)::numeric, 4) AS value_ratio,
      ROUND(vb.ratio_mean, 4)   AS ratio_mean,
      ROUND(vb.ratio_stddev, 4) AS ratio_stddev,
      ROUND((((cl.score_value / cl.current_price_lb) - vb.ratio_mean) / vb.ratio_stddev)::numeric, 2) AS value_z
    FROM tmp_current_lots cl
    JOIN (
      SELECT origin, market,
             avg(score_value / current_price_lb)         AS ratio_mean,
             stddev_samp(score_value / current_price_lb) AS ratio_stddev
      FROM tmp_current_lots
      WHERE origin IS NOT NULL AND score_value IS NOT NULL
        AND score_value > 0 AND current_price_lb > 0
      GROUP BY origin, market
      HAVING count(*) >= v_benchmark_min_lots
         AND count(DISTINCT source) >= v_benchmark_min_suppliers
         AND count(DISTINCT score_value / current_price_lb) >= 2
         AND stddev_samp(score_value / current_price_lb) > 0
    ) vb ON vb.origin = cl.origin AND vb.market = cl.market
    WHERE cl.origin IS NOT NULL AND cl.score_value IS NOT NULL
      AND cl.score_value > 0 AND cl.current_price_lb > 0
  ) v
  WHERE v.value_z >= v_value_z_threshold;

  DROP TABLE IF EXISTS tmp_current_lots;

  RETURN QUERY
    SELECT ms.signal_type, count(*)::bigint
    FROM public.market_signals ms
    WHERE ms.snapshot_date = p_date
    GROUP BY ms.signal_type
    ORDER BY ms.signal_type;
END;
$$;

COMMENT ON FUNCTION public.compute_market_signals(date) IS
  'Emits market_signals for a date (§3.2 detection + §3.3 evidence). Idempotent delete-and-rewrite. '
  'Signals are a live feed, never backfilled. Called by coffee-scraper after compute_price_index.';


-- ============================================================
-- compute_metadata_index(p_date)
-- Recomputes the week (Monday) and month (1st) periods containing p_date for
-- dimensions process|disclosure|score. Aggregation = mean of daily shares.
-- Backfill-safe: delete-and-rewrite each affected (period, grain). Origin-level
-- groups with mean daily lot_count < 5 are suppressed; market-wide (origin NULL)
-- always written. Uses CURRENT catalog metadata vs historical stocked state.
-- ============================================================
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
  -- The origin LATERAL avoids the null-country double-count (NULL row once + the
  -- country row only when present).
  CREATE TEMP TABLE tmp_lots ON COMMIT DROP AS
  SELECT
    tp.grain, tp.period_start, ps.snapshot_date,
    ms.market AS market, os.origin AS origin,
    ps.catalog_id, cc.source,
    COALESCE(cc.processing_base_method, 'undisclosed')      AS process_bucket,
    COALESCE(cc.processing_disclosure_level, 'undisclosed') AS disclosure_bucket,
    cc.score_value
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

  -- Daily group totals per (grain, period, market, origin, snapshot_date).
  CREATE TEMP TABLE tmp_daily_totals ON COMMIT DROP AS
  SELECT grain, period_start, market, origin, snapshot_date, count(*) AS day_total_lots
  FROM tmp_lots
  GROUP BY grain, period_start, market, origin, snapshot_date;

  -- Origin suppression floor: origin-level groups need mean daily lots >= 5;
  -- market-wide (origin NULL) always kept.
  CREATE TEMP TABLE tmp_kept_groups ON COMMIT DROP AS
  SELECT grain, period_start, market, origin
  FROM tmp_daily_totals
  GROUP BY grain, period_start, market, origin
  HAVING origin IS NULL OR avg(day_total_lots) >= v_min_origin_lots;

  -- Score dimension needs its OWN suppression floor. tmp_kept_groups is built on all
  -- stocked lots, so an origin with >= 5 stocked lots but only 1-4 SCORED lots would
  -- still emit origin-level p25/p50/p75 score rows from a tiny sample, violating the
  -- origin-row suppression contract. Floor on mean daily SCORED lots instead; market-
  -- wide (origin NULL) always kept, matching the general contract.
  CREATE TEMP TABLE tmp_scored_daily_totals ON COMMIT DROP AS
  SELECT grain, period_start, market, origin, snapshot_date,
         count(*) FILTER (WHERE score_value IS NOT NULL) AS day_scored_lots
  FROM tmp_lots
  GROUP BY grain, period_start, market, origin, snapshot_date;

  CREATE TEMP TABLE tmp_kept_score_groups ON COMMIT DROP AS
  SELECT grain, period_start, market, origin
  FROM tmp_scored_daily_totals
  GROUP BY grain, period_start, market, origin
  HAVING origin IS NULL OR avg(day_scored_lots) >= v_min_origin_lots;

  -- ---------- process + disclosure (share-based) ----------
  -- Zero-share days matter: a bucket that is absent on some snapshot dates still
  -- occupies 0% of those days. Build a (group-day x bucket) grid so missing
  -- bucket-days coalesce to 0 lots/suppliers before averaging; otherwise share,
  -- lot_count, and supplier_count are inflated by averaging only the days the
  -- bucket actually appeared instead of every day the group had data.
  INSERT INTO public.metadata_index_snapshots
    (period_start, grain, origin, market, dimension, bucket, lot_count, share, stat_value, supplier_count)
  WITH day_bucket AS (
    SELECT
      l.grain, l.period_start, l.market, l.origin, l.snapshot_date, dim.dimension,
      CASE dim.dimension WHEN 'process' THEN l.process_bucket ELSE l.disclosure_bucket END AS bucket,
      count(*) AS day_bucket_lots,
      count(DISTINCT l.source) AS day_bucket_suppliers
    FROM tmp_lots l
    CROSS JOIN (VALUES ('process'), ('disclosure')) AS dim(dimension)
    GROUP BY l.grain, l.period_start, l.market, l.origin, l.snapshot_date, dim.dimension,
             CASE dim.dimension WHEN 'process' THEN l.process_bucket ELSE l.disclosure_bucket END
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
  GROUP BY g.period_start, g.grain, g.origin, g.market, grid.dimension, grid.bucket;

  -- ---------- score (percentile-based) ----------
  INSERT INTO public.metadata_index_snapshots
    (period_start, grain, origin, market, dimension, bucket, lot_count, share, stat_value, supplier_count)
  SELECT
    g.period_start, g.grain, g.origin, g.market, 'score', pk.bucket,
    round(avg(pk.day_scored_lots))::int      AS lot_count,
    NULL::numeric                            AS share,
    round(avg(pk.pct_value)::numeric, 2)     AS stat_value,
    round(avg(pk.day_scored_suppliers))::int AS supplier_count
  FROM tmp_kept_score_groups g
  JOIN (
    SELECT
      s.grain, s.period_start, s.market, s.origin, s.snapshot_date, b.bucket,
      CASE b.bucket
        WHEN 'p25' THEN percentile_cont(0.25) WITHIN GROUP (ORDER BY s.score_value)
        WHEN 'p50' THEN percentile_cont(0.50) WITHIN GROUP (ORDER BY s.score_value)
        ELSE            percentile_cont(0.75) WITHIN GROUP (ORDER BY s.score_value)
      END AS pct_value,
      count(*) AS day_scored_lots,
      count(DISTINCT s.source) AS day_scored_suppliers
    FROM tmp_lots s
    CROSS JOIN (VALUES ('p25'), ('p50'), ('p75')) AS b(bucket)
    WHERE s.score_value IS NOT NULL
    GROUP BY s.grain, s.period_start, s.market, s.origin, s.snapshot_date, b.bucket
  ) pk
    ON pk.grain = g.grain AND pk.period_start = g.period_start
   AND pk.market = g.market AND pk.origin IS NOT DISTINCT FROM g.origin
  GROUP BY g.period_start, g.grain, g.origin, g.market, pk.bucket;

  DROP TABLE IF EXISTS tmp_lots;
  DROP TABLE IF EXISTS tmp_daily_totals;
  DROP TABLE IF EXISTS tmp_kept_groups;
  DROP TABLE IF EXISTS tmp_scored_daily_totals;
  DROP TABLE IF EXISTS tmp_kept_score_groups;
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
  'Mean-of-daily-shares; origin groups < 5 mean daily lots suppressed; market-wide always written. '
  'Backfill-safe (idempotent per period/grain). Called by coffee-scraper and the metadata backfill script.';


-- ============================================================
-- compute_price_move_stats(p_date, p_baseline_weeks)
-- Precomputes movement-significance stats (§3.4/§4.5) for market-wide and segment
-- grains across markets {retail,wholesale,all} and windows {7d,30d}. Baseline =
-- the window-move sampled at weekly cadence over the trailing p_baseline_weeks
-- weeks; percentile/classification use ABS move magnitude.
-- ============================================================
DROP FUNCTION IF EXISTS public.compute_price_move_stats(date, int);
CREATE OR REPLACE FUNCTION public.compute_price_move_stats(
  p_date           date DEFAULT CURRENT_DATE,
  p_baseline_weeks int  DEFAULT 12
)
RETURNS TABLE (rows_written bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_min_baseline_weeks int := 8;
  v_required_baseline_weeks int := greatest(v_min_baseline_weeks, p_baseline_weeks);
  v_pct_quiet   numeric := 40;
  v_pct_normal  numeric := 85;
  v_pct_notable numeric := 97;
BEGIN
  DELETE FROM public.price_index_move_stats
  WHERE snapshot_date = p_date AND baseline_weeks = p_baseline_weeks;

  -- Live segment tuples: market-wide + per-origin + per-process + per-(origin,process),
  -- for each market and window.
  CREATE TEMP TABLE tmp_segments ON COMMIT DROP AS
  WITH lots AS (
    SELECT DISTINCT cc.country AS origin,
           COALESCE(cc.processing_base_method, 'undisclosed') AS process
    FROM public.coffee_price_snapshots ps
    JOIN public.coffee_catalog cc ON cc.id = ps.catalog_id
    WHERE ps.snapshot_date = p_date AND ps.stocked = true
      AND ps.cost_lb IS NOT NULL AND ps.cost_lb > 0
  ),
  seg AS (
    SELECT NULL::text AS origin, NULL::text AS process
    UNION SELECT origin, NULL FROM lots WHERE origin IS NOT NULL
    UNION SELECT NULL, process FROM lots
    UNION SELECT origin, process FROM lots WHERE origin IS NOT NULL
  )
  SELECT seg.origin, seg.process, m.market, w.move_window, w.days
  FROM seg
  CROSS JOIN (VALUES ('retail'), ('wholesale'), ('all')) AS m(market)
  CROSS JOIN (VALUES ('7d', 7), ('30d', 30)) AS w(move_window, days);

  -- Segment median cost_lb (+ sample/supplier counts) at each date we need:
  -- the endpoint date, its window start, and each weekly baseline endpoint pair.
  CREATE TEMP TABLE tmp_medians ON COMMIT DROP AS
  SELECT s.origin, s.process, s.market, s.move_window, s.days, dts.as_of_date,
         agg.med, agg.sample_size, agg.supplier_count
  FROM tmp_segments s
  CROSS JOIN LATERAL (
    SELECT DISTINCT gs.as_of_date FROM (
      SELECT p_date AS as_of_date
      UNION ALL SELECT p_date - s.days
      UNION ALL SELECT (p_date - (g * 7))::date          FROM generate_series(0, p_baseline_weeks) g
      UNION ALL SELECT (p_date - (g * 7) - s.days)::date FROM generate_series(0, p_baseline_weeks) g
    ) gs
  ) dts
  CROSS JOIN LATERAL (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ps.cost_lb) AS med,
      count(*)                                                AS sample_size,
      count(DISTINCT cc.source) FILTER (WHERE cc.source IS NOT NULL) AS supplier_count
    FROM public.coffee_price_snapshots ps
    JOIN public.coffee_catalog cc ON cc.id = ps.catalog_id
    WHERE ps.snapshot_date = dts.as_of_date
      AND ps.stocked = true AND ps.cost_lb IS NOT NULL AND ps.cost_lb > 0
      AND (s.origin  IS NULL OR cc.country = s.origin)
      AND (s.process IS NULL OR COALESCE(cc.processing_base_method,'undisclosed') = s.process)
      AND (s.market = 'all' OR (s.market = 'wholesale') = ps.wholesale)
  ) agg;

  -- Window-move at each weekly sample = (med(end) - med(start)) / med(start) * 100.
  CREATE TEMP TABLE tmp_moves ON COMMIT DROP AS
  SELECT s.origin, s.process, s.market, s.move_window, s.days, g AS k,
         CASE WHEN ms.med IS NOT NULL AND ms.med > 0 AND me.med IS NOT NULL
              THEN ROUND(((me.med - ms.med) / ms.med * 100)::numeric, 2) END AS move_pct
  FROM tmp_segments s
  CROSS JOIN generate_series(0, p_baseline_weeks) g
  LEFT JOIN tmp_medians me
    ON me.origin IS NOT DISTINCT FROM s.origin AND me.process IS NOT DISTINCT FROM s.process
   AND me.market = s.market AND me.move_window = s.move_window
   AND me.as_of_date = (p_date - (g * 7))::date
  LEFT JOIN tmp_medians ms
    ON ms.origin IS NOT DISTINCT FROM s.origin AND ms.process IS NOT DISTINCT FROM s.process
   AND ms.market = s.market AND ms.move_window = s.move_window
   AND ms.as_of_date = (p_date - (g * 7) - s.days)::date;

  INSERT INTO public.price_index_move_stats (
    snapshot_date, origin, process, market, move_window, baseline_weeks,
    latest_move_pct, baseline_mean_move_pct, baseline_stddev, z_score,
    move_percentile, weeks_since_larger_move, classification,
    matched_lot_move_pct, matched_lot_count, move_driver,
    sample_size, supplier_count, available_baseline_weeks, note
  )
  SELECT
    p_date, s.origin, s.process, s.market, s.move_window, p_baseline_weeks,
    latest.move_pct,
    base.mean_move,
    base.sd_move,
    CASE WHEN latest.move_pct IS NOT NULL AND base.avail >= v_required_baseline_weeks AND base.sd_move > 0
         THEN ROUND(((latest.move_pct - base.mean_move) / base.sd_move)::numeric, 2) END,
    CASE WHEN latest.move_pct IS NOT NULL AND base.avail >= v_required_baseline_weeks
         THEN ROUND((100.0 * (base.n_lt + (base.n_eq * 0.5)) / base.avail)::numeric, 1) END,
    CASE WHEN latest.move_pct IS NOT NULL AND base.avail >= v_required_baseline_weeks
         THEN base.weeks_since_larger END,
    CASE WHEN latest.move_pct IS NOT NULL AND base.avail >= v_required_baseline_weeks THEN
      (CASE
        WHEN (100.0 * (base.n_lt + (base.n_eq * 0.5)) / base.avail) < v_pct_quiet   THEN 'quiet'
        WHEN (100.0 * (base.n_lt + (base.n_eq * 0.5)) / base.avail) < v_pct_normal  THEN 'normal'
        WHEN (100.0 * (base.n_lt + (base.n_eq * 0.5)) / base.avail) < v_pct_notable THEN 'notable'
        ELSE 'exceptional' END)
    END,
    matched.matched_move,
    COALESCE(matched.matched_count, 0),
    CASE
      WHEN COALESCE(matched.matched_count, 0) < 8 THEN 'insufficient_overlap'
      WHEN latest.move_pct IS NULL OR matched.matched_move IS NULL THEN 'insufficient_overlap'
      WHEN abs(latest.move_pct - matched.matched_move) <= 1.0 THEN 'repricing'
      WHEN abs(matched.matched_move) < 0.5 AND abs(latest.move_pct) >= 1.0 THEN 'mix_shift'
      ELSE 'mixed'
    END,
    lm.sample_size, lm.supplier_count,
    base.avail,
    CASE WHEN latest.move_pct IS NULL OR base.avail < v_required_baseline_weeks
         THEN 'insufficient_baseline_history' END
  FROM tmp_segments s
  LEFT JOIN tmp_moves latest
    ON latest.origin IS NOT DISTINCT FROM s.origin AND latest.process IS NOT DISTINCT FROM s.process
   AND latest.market = s.market AND latest.move_window = s.move_window AND latest.k = 0
  LEFT JOIN tmp_medians lm
    ON lm.origin IS NOT DISTINCT FROM s.origin AND lm.process IS NOT DISTINCT FROM s.process
   AND lm.market = s.market AND lm.move_window = s.move_window AND lm.as_of_date = p_date
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE m.move_pct IS NOT NULL)                                AS avail,
      round(avg(m.move_pct), 2)                                                     AS mean_move,
      round(stddev_samp(m.move_pct), 4)                                             AS sd_move,
      count(*) FILTER (WHERE m.move_pct IS NOT NULL
                         AND abs(m.move_pct) < abs(latest.move_pct))                AS n_lt,
      count(*) FILTER (WHERE m.move_pct IS NOT NULL
                         AND abs(m.move_pct) = abs(latest.move_pct))                AS n_eq,
      min(m.k) FILTER (WHERE m.move_pct IS NOT NULL
                         AND abs(m.move_pct) > abs(latest.move_pct))                AS weeks_since_larger
    FROM tmp_moves m
    WHERE m.origin IS NOT DISTINCT FROM s.origin AND m.process IS NOT DISTINCT FROM s.process
      AND m.market = s.market AND m.move_window = s.move_window AND m.k >= 1
  ) base ON true
  LEFT JOIN LATERAL (
    SELECT
      round(percentile_cont(0.5) WITHIN GROUP (
        ORDER BY (e.cost_lb - b.cost_lb) / b.cost_lb * 100)::numeric, 2) AS matched_move,
      count(*) AS matched_count
    FROM public.coffee_price_snapshots e
    JOIN public.coffee_price_snapshots b
      ON b.catalog_id = e.catalog_id AND b.snapshot_date = p_date - s.days
    JOIN public.coffee_catalog cc ON cc.id = e.catalog_id
    WHERE e.snapshot_date = p_date
      AND e.stocked = true AND e.cost_lb IS NOT NULL AND e.cost_lb > 0
      AND b.stocked = true AND b.cost_lb IS NOT NULL AND b.cost_lb > 0
      AND (s.origin  IS NULL OR cc.country = s.origin)
      AND (s.process IS NULL OR COALESCE(cc.processing_base_method,'undisclosed') = s.process)
      -- Require BOTH endpoints in the selected market so a lot that switches
      -- between retail and wholesale across the window is not counted as repricing.
      AND (s.market = 'all' OR (s.market = 'wholesale') = e.wholesale)
      AND (s.market = 'all' OR (s.market = 'wholesale') = b.wholesale)
  ) matched ON true
  WHERE latest.move_pct IS NOT NULL OR COALESCE(lm.sample_size, 0) > 0;

  DROP TABLE IF EXISTS tmp_segments;
  DROP TABLE IF EXISTS tmp_medians;
  DROP TABLE IF EXISTS tmp_moves;

  RETURN QUERY
    SELECT count(*)::bigint FROM public.price_index_move_stats
    WHERE snapshot_date = p_date AND baseline_weeks = p_baseline_weeks;
END;
$$;

COMMENT ON FUNCTION public.compute_price_move_stats(date, int) IS
  'Precomputes movement-significance stats (§3.4/§4.5) for market-wide + segment grains, markets, and 7d/30d windows. '
  'Weekly-sampled baseline; abs-magnitude percentile/classification; matched-lot move_driver. '
  'insufficient_baseline_history when available_baseline_weeks is below the requested baseline or launch minimum. Called by coffee-scraper after compute_price_index.';


-- ============================================================
-- Grants: service_role executes all three (scraper uses the service key).
-- Postgres grants EXECUTE to PUBLIC on new functions by default, so these
-- SECURITY DEFINER functions (which delete/rewrite the premium precompute tables
-- and accept arbitrary dates / baseline_weeks) must have that default revoked
-- first, otherwise any anon/authenticated caller who knows the RPC name could
-- invoke them via PostgREST and force expensive recomputation.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.compute_market_signals(date)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_metadata_index(date)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_price_move_stats(date, int) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compute_market_signals(date)        TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_metadata_index(date)        TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_price_move_stats(date, int) TO service_role;

-- ============================================================
-- PURVEYORS PRICE INDEX: Price Snapshot Tables
-- Migration: 20260321_price_snapshots.sql
-- Date: 2026-03-21
-- Purpose:
--   1. Add scraped_at column to coffee_catalog (Phase 0.1)
--   2. Create coffee_price_snapshots (raw per-bean daily history)
--   3. Create price_index_snapshots (aggregated PPI, matches master plan)
--   4. Create compute_price_index() RPC function
--   5. RLS policies + grants for Supabase
-- ============================================================

-- ============================================================
-- PART 1: Add scraped_at to coffee_catalog
-- Tracks when a bean was last confirmed by the scraper.
-- Updated on every scrape run (price update, insert, or unstock).
-- Distinct from last_updated (which is NOT updated on price changes).
-- ============================================================

ALTER TABLE public.coffee_catalog
  ADD COLUMN IF NOT EXISTS scraped_at timestamptz;

-- Backfill: use stocked_date or unstocked_date as a proxy for existing rows
-- that were last touched at a known time.
UPDATE public.coffee_catalog
SET scraped_at = GREATEST(
  COALESCE(stocked_date::timestamptz, '2020-01-01'::timestamptz),
  COALESCE(unstocked_date::timestamptz, '2020-01-01'::timestamptz)
)
WHERE scraped_at IS NULL;

-- ============================================================
-- PART 2: coffee_price_snapshots
-- Raw per-bean daily price history written by the scraper.
-- One row per (catalog_id, snapshot_date).
-- Insert strategy: ON CONFLICT DO NOTHING — first scrape of the day wins.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coffee_price_snapshots (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  catalog_id    integer NOT NULL REFERENCES public.coffee_catalog(id) ON DELETE CASCADE,
  snapshot_date date    NOT NULL,

  -- Price at snapshot time
  cost_lb       numeric(10, 2),                  -- retail 1-lb price
  price_tiers   jsonb,                           -- full tier array [{min_lbs, price}, ...]

  -- Availability/character at snapshot time
  stocked       boolean NOT NULL DEFAULT true,
  wholesale     boolean NOT NULL DEFAULT false,  -- minimum tier > 5 lbs

  -- Audit
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- One row per bean per day — deduplication enforced at DB level
  CONSTRAINT uq_price_snapshot_bean_date UNIQUE (catalog_id, snapshot_date)
);

COMMENT ON TABLE public.coffee_price_snapshots IS
  'Raw per-bean daily price snapshots written by coffee-scraper after each source run. '
  'Canonical source for PPI aggregation. One row per (catalog_id, snapshot_date). '
  'Write strategy: scraper inserts with ON CONFLICT DO NOTHING — first run of the day wins. '
  'See: notes/price-snapshot-strategy-research.md';

COMMENT ON COLUMN public.coffee_price_snapshots.cost_lb IS
  'Price per pound at 1-lb tier. Always comparable across suppliers.';
COMMENT ON COLUMN public.coffee_price_snapshots.price_tiers IS
  'Full pricing tier array [{min_lbs, price}] sorted by min_lbs ascending. '
  'Required for "price at your quantity" queries.';
COMMENT ON COLUMN public.coffee_price_snapshots.stocked IS
  'Whether the bean was in stock at snapshot time. '
  'Enables supply availability pattern analysis.';

-- ============================================================
-- PART 2a: Indexes for coffee_price_snapshots
-- ============================================================

-- Time-series scan: all beans on a given date (PPI aggregation query)
CREATE INDEX IF NOT EXISTS idx_price_snap_date
  ON public.coffee_price_snapshots (snapshot_date DESC);

-- Per-bean history: price trend for a specific bean
CREATE INDEX IF NOT EXISTS idx_price_snap_catalog_date
  ON public.coffee_price_snapshots (catalog_id, snapshot_date DESC);

-- Date range scan for stocked beans only (most PPI queries exclude unstocked)
CREATE INDEX IF NOT EXISTS idx_price_snap_date_stocked
  ON public.coffee_price_snapshots (snapshot_date DESC)
  WHERE stocked = true;

-- Partial index: non-wholesale (retail PPI)
CREATE INDEX IF NOT EXISTS idx_price_snap_retail
  ON public.coffee_price_snapshots (snapshot_date DESC, catalog_id)
  WHERE stocked = true AND wholesale = false;

-- ============================================================
-- PART 3: price_index_snapshots
-- Pre-aggregated PPI: computed once/day from coffee_price_snapshots.
-- Matches the schema in analytics-platform-master-plan.md Phase 1.
-- Extended with wholesale_only column to segment retail vs wholesale.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.price_index_snapshots (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date  date        NOT NULL,

  -- Segmentation dimensions (normalized via origin_aliases / process_aliases)
  origin         text        NOT NULL,  -- normalized country/origin, e.g. "Ethiopia"
  process        text,                  -- normalized: Washed, Natural, Honey, etc.
  grade          text,                  -- normalized: G1, G2, etc. NULL = all grades

  -- Aggregate statistics across all suppliers for this segment + date
  supplier_count  integer     NOT NULL,  -- number of distinct sources in this bucket
  price_min       numeric(10, 2),
  price_max       numeric(10, 2),
  price_avg       numeric(10, 2),
  price_median    numeric(10, 2),
  sample_size     integer     NOT NULL,  -- number of beans contributing to this bucket

  -- Segmentation flag: retail (min tier <= 5 lbs) vs wholesale-only suppliers
  wholesale_only  boolean     NOT NULL DEFAULT false,

  -- Audit
  created_at      timestamptz DEFAULT now()
);

-- Unique index handles NULLs in process/grade via COALESCE
CREATE UNIQUE INDEX uq_ppi_segment_date
ON price_index_snapshots (
  snapshot_date, origin, COALESCE(process, ''), COALESCE(grade, ''), wholesale_only
);

COMMENT ON TABLE public.price_index_snapshots IS
  'Pre-aggregated Purveyors Price Index (PPI). Computed daily from coffee_price_snapshots. '
  'Segmented by origin, process, grade, and wholesale flag. '
  'Used by /api/price-index endpoint and public analytics page. '
  'See: notes/analytics-platform-master-plan.md Phase 1.';

COMMENT ON COLUMN public.price_index_snapshots.origin IS
  'Normalized country/origin name. Must match origin_aliases.canonical. '
  'Examples: "Ethiopia", "Colombia", "Guatemala".';
COMMENT ON COLUMN public.price_index_snapshots.process IS
  'Normalized processing method. NULL = no process filter (all processes aggregated). '
  'Values: Washed, Natural, Honey, Anaerobic, Semi-washed, Wet-hulled.';
COMMENT ON COLUMN public.price_index_snapshots.grade IS
  'Normalized grade. NULL = no grade filter (all grades aggregated). '
  'Values: G1, G2, SHB, AA, etc. (after normalization via grade aliases).';
COMMENT ON COLUMN public.price_index_snapshots.wholesale_only IS
  'True = this row aggregates only wholesale-minimum suppliers (min_lbs > 5). '
  'False = retail suppliers (min_lbs <= 5, comparable to home-roaster quantities).';

-- ============================================================
-- PART 3a: Indexes for price_index_snapshots
-- ============================================================

-- Primary API query: filter by date range (most common)
CREATE INDEX IF NOT EXISTS idx_ppi_date
  ON public.price_index_snapshots (snapshot_date DESC);

-- Filter by origin (line chart data: one origin over time)
CREATE INDEX IF NOT EXISTS idx_ppi_origin_date
  ON public.price_index_snapshots (origin, snapshot_date DESC);

-- Combined filter: origin + process + date range (the most specific query)
CREATE INDEX IF NOT EXISTS idx_ppi_origin_process_date
  ON public.price_index_snapshots (origin, process, snapshot_date DESC);

-- Origin comparison on a single date (bar chart data)
CREATE INDEX IF NOT EXISTS idx_ppi_date_origin
  ON public.price_index_snapshots (snapshot_date DESC, origin);

-- Retail PPI only (most public-facing queries)
CREATE INDEX IF NOT EXISTS idx_ppi_retail_date
  ON public.price_index_snapshots (snapshot_date DESC)
  WHERE wholesale_only = false;

-- ============================================================
-- PART 4: compute_price_index() RPC function
-- Called by scraper after all sources complete each day.
-- Reads coffee_price_snapshots, joins coffee_catalog for origin/process/grade,
-- computes aggregates, upserts to price_index_snapshots.
-- Aggregates price data from coffee_price_snapshots into price_index_snapshots.
-- Origin/processing normalization is handled at scraper ingest time.
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_price_index(
  p_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  origin        text,
  process       text,
  grade         text,
  wholesale_only boolean,
  supplier_count int,
  sample_size   int,
  price_avg     numeric,
  price_min     numeric,
  price_max     numeric,
  price_median  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as owner; safe for service role callers
AS $$
BEGIN
  -- Build aggregates from raw snapshots joined to catalog for origin/process/grade
  -- Uses COALESCE for origin_aliases — table may not exist yet (Phase 0.3)
  WITH raw AS (
    SELECT
      ps.catalog_id,
      ps.cost_lb,
      ps.stocked,
      ps.wholesale,
      -- Origin and processing are normalized at scraper ingest time
      -- (normalizeOrigin/normalizeProcessing in dataValidators.ts)
      -- No DB-side alias lookup needed.
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
  -- Aggregate by (origin, process, grade, wholesale_only)
  agg AS (
    SELECT
      origin,
      process,
      grade,
      wholesale   AS wholesale_only,
      COUNT(DISTINCT source)::int                             AS supplier_count,
      COUNT(*)::int                                           AS sample_size,
      ROUND(AVG(cost_lb)::numeric, 2)                        AS price_avg,
      ROUND(MIN(cost_lb)::numeric, 2)                        AS price_min,
      ROUND(MAX(cost_lb)::numeric, 2)                        AS price_max,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY cost_lb
      )::numeric, 2)                                         AS price_median
    FROM raw
    WHERE origin IS NOT NULL
    GROUP BY origin, process, grade, wholesale
    HAVING COUNT(*) >= 2  -- require at least 2 beans to form a meaningful index point
  )
  -- Upsert into price_index_snapshots
  INSERT INTO public.price_index_snapshots (
    snapshot_date,
    origin,
    process,
    grade,
    wholesale_only,
    supplier_count,
    sample_size,
    price_avg,
    price_min,
    price_max,
    price_median
  )
  SELECT
    p_date,
    a.origin,
    a.process,
    a.grade,
    a.wholesale_only,
    a.supplier_count,
    a.sample_size,
    a.price_avg,
    a.price_min,
    a.price_max,
    a.price_median
  FROM agg a
  ON CONFLICT (snapshot_date, origin, COALESCE(process, ''), COALESCE(grade, ''), wholesale_only)
  DO UPDATE SET
    supplier_count = EXCLUDED.supplier_count,
    sample_size    = EXCLUDED.sample_size,
    price_avg      = EXCLUDED.price_avg,
    price_min      = EXCLUDED.price_min,
    price_max      = EXCLUDED.price_max,
    price_median   = EXCLUDED.price_median,
    created_at     = now();

  -- Return what was computed (for logging)
  RETURN QUERY
    SELECT
      pis.origin,
      pis.process,
      pis.grade,
      pis.wholesale_only,
      pis.supplier_count,
      pis.sample_size,
      pis.price_avg,
      pis.price_min,
      pis.price_max,
      pis.price_median
    FROM public.price_index_snapshots pis
    WHERE pis.snapshot_date = p_date
    ORDER BY pis.origin, pis.process NULLS LAST, pis.grade NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.compute_price_index(date) IS
  'Aggregates coffee_price_snapshots into price_index_snapshots for a given date. '
  'Called by coffee-scraper after all sources complete. Safe to re-run (idempotent upsert). '
  'Normalization done at scraper ingest (normalizeOrigin/normalizeProcessing in dataValidators.ts).';

-- ============================================================
-- PART 5: RLS Policies
-- ============================================================

-- coffee_price_snapshots: public read (needed for analytics page),
--   service role write (scraper uses service key)
ALTER TABLE public.coffee_price_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coffee_price_snapshots'
      AND policyname = 'Public read coffee_price_snapshots'
  ) THEN
    CREATE POLICY "Public read coffee_price_snapshots"
      ON public.coffee_price_snapshots
      FOR SELECT
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'coffee_price_snapshots'
      AND policyname = 'Service role write coffee_price_snapshots'
  ) THEN
    CREATE POLICY "Service role write coffee_price_snapshots"
      ON public.coffee_price_snapshots
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- price_index_snapshots: public read (analytics page, free API tier),
--   service role write (compute_price_index runs as SECURITY DEFINER)
ALTER TABLE public.price_index_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'price_index_snapshots'
      AND policyname = 'Public read price_index_snapshots'
  ) THEN
    CREATE POLICY "Public read price_index_snapshots"
      ON public.price_index_snapshots
      FOR SELECT
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'price_index_snapshots'
      AND policyname = 'Service role write price_index_snapshots'
  ) THEN
    CREATE POLICY "Service role write price_index_snapshots"
      ON public.price_index_snapshots
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- ============================================================
-- PART 6: GRANT statements
-- ============================================================

-- Allow anon and authenticated to read both tables (analytics page, public API)
GRANT SELECT ON public.coffee_price_snapshots TO anon, authenticated;
GRANT SELECT ON public.price_index_snapshots TO anon, authenticated;

-- Allow service role full access (scraper inserts, backfills)
GRANT ALL ON public.coffee_price_snapshots TO service_role;
GRANT ALL ON public.price_index_snapshots TO service_role;

-- Grant sequence access (needed for IDENTITY column inserts by service role)
GRANT USAGE, SELECT ON SEQUENCE public.coffee_price_snapshots_id_seq TO service_role;

-- Allow anon + authenticated to call compute_price_index (used by scheduled jobs)
-- Service role can always execute SECURITY DEFINER functions
GRANT EXECUTE ON FUNCTION public.compute_price_index(date) TO service_role;

-- ============================================================
-- PART 7: TEST QUERIES
-- Uncomment and run in Supabase SQL Editor to verify after data accumulates.
-- ============================================================

-- Check snapshot coverage for today:
-- SELECT
--   source,
--   COUNT(*) AS snapshots,
--   COUNT(*) FILTER (WHERE cost_lb IS NOT NULL) AS with_price,
--   MIN(cost_lb) AS min_price,
--   MAX(cost_lb) AS max_price,
--   AVG(cost_lb)::numeric(10,2) AS avg_price
-- FROM coffee_price_snapshots ps
-- JOIN coffee_catalog cc ON cc.id = ps.catalog_id
-- WHERE snapshot_date = CURRENT_DATE
-- GROUP BY source
-- ORDER BY source;

-- Run the PPI aggregation for today and preview results:
-- SELECT * FROM compute_price_index(CURRENT_DATE)
-- ORDER BY origin, process NULLS LAST, grade NULLS LAST;

-- Time-series for Ethiopian prices (requires 7+ days of data):
-- SELECT
--   snapshot_date,
--   origin,
--   process,
--   supplier_count,
--   sample_size,
--   price_min,
--   price_avg,
--   price_max,
--   price_median
-- FROM price_index_snapshots
-- WHERE origin = 'Ethiopia'
--   AND wholesale_only = false
--   AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
-- ORDER BY snapshot_date DESC, process NULLS LAST;

-- Bean-level price trend (requires 7+ days of data):
-- SELECT
--   ps.snapshot_date,
--   cc.name,
--   cc.source,
--   cc.country,
--   ps.cost_lb,
--   ps.stocked
-- FROM coffee_price_snapshots ps
-- JOIN coffee_catalog cc ON cc.id = ps.catalog_id
-- WHERE ps.catalog_id = 1182  -- replace with real catalog ID
--   AND ps.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
-- ORDER BY ps.snapshot_date DESC;

-- Storage estimate for current scale:
-- SELECT
--   pg_size_pretty(pg_total_relation_size('coffee_price_snapshots')) AS raw_snapshots_size,
--   pg_size_pretty(pg_total_relation_size('price_index_snapshots')) AS ppi_size,
--   COUNT(*) AS raw_snapshot_rows
-- FROM coffee_price_snapshots;

-- Verify no duplicate (catalog_id, snapshot_date) pairs:
-- SELECT catalog_id, snapshot_date, COUNT(*) AS cnt
-- FROM coffee_price_snapshots
-- GROUP BY catalog_id, snapshot_date
-- HAVING COUNT(*) > 1;

-- Price change detection: beans that changed price since yesterday:
-- SELECT
--   cc.name,
--   cc.source,
--   cc.country,
--   t.cost_lb AS today_price,
--   y.cost_lb AS yesterday_price,
--   ROUND((t.cost_lb - y.cost_lb) / y.cost_lb * 100, 1) AS pct_change
-- FROM coffee_price_snapshots t
-- JOIN coffee_price_snapshots y
--   ON t.catalog_id = y.catalog_id
--   AND y.snapshot_date = CURRENT_DATE - 1
-- JOIN coffee_catalog cc ON cc.id = t.catalog_id
-- WHERE t.snapshot_date = CURRENT_DATE
--   AND t.cost_lb IS NOT NULL
--   AND y.cost_lb IS NOT NULL
--   AND t.cost_lb != y.cost_lb
-- ORDER BY ABS(t.cost_lb - y.cost_lb) DESC;

-- PPI dashboard query: current day origin comparison (bar chart data):
-- SELECT
--   origin,
--   process,
--   price_avg,
--   price_min,
--   price_max,
--   supplier_count,
--   sample_size
-- FROM price_index_snapshots
-- WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM price_index_snapshots)
--   AND wholesale_only = false
--   AND process IS NOT NULL
-- ORDER BY price_avg DESC;

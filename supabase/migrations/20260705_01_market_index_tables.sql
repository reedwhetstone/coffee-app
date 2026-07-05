-- ============================================================
-- MARKET INDEX DECISION SURFACE: Precompute Tables (B-1)
-- Migration: 20260705_01_market_index_tables.sql
-- Date: 2026-07-05
-- Implements: ADR-008 + market-index-decision-surface-plan.md §4.1/§4.2
--   (+ market-index-backend-build-plan.md, decision D2/D4)
-- Purpose:
--   1. market_signals            (§4.1) — daily actionable value-signal feed
--   2. metadata_index_snapshots  (§4.2) — metadata-trend index (process/disclosure/score)
--   3. price_index_move_stats    (D2)   — precomputed movement-significance stats
--   4. Service-role-only RLS + grants (D4): these carry premium leverage, so
--      entitlement is enforced ENTIRELY in the API layer. Unlike
--      coffee_price_snapshots / price_index_snapshots (public read), these tables
--      grant NOTHING to anon/authenticated. RLS cannot leak what is never granted.
--
-- Companion migration 20260705_02_market_index_compute.sql defines the compute RPCs.
-- ============================================================

-- ============================================================
-- PART 1: market_signals (§4.1)
-- One row per active signal per day. Written by compute_market_signals();
-- the /v1/market/signals endpoint is a filtered read of the latest day.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.market_signals (
  id               bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date    date    NOT NULL,
  signal_type      text    NOT NULL CHECK (signal_type IN ('price_drop','below_market','value_quality')),
  signal_window    text    NOT NULL DEFAULT 'n/a' CHECK (signal_window IN ('7d','30d','n/a')),
  catalog_id       integer NOT NULL REFERENCES public.coffee_catalog(id) ON DELETE CASCADE,

  -- Denormalized for filtering without a join back to coffee_catalog.
  origin           text,                    -- nullable: from coffee_catalog.country
  process          text    NOT NULL,        -- normalized bucket; 'undisclosed' for missing metadata
  market           text    NOT NULL CHECK (market IN ('retail','wholesale')),
  source           text,                    -- nullable: coffee_catalog.source is nullable
  score_value      numeric,
  current_price_lb numeric(10, 2) NOT NULL,

  -- Ordering key: signal strength x quality prior (see §4.1). rank_score_input
  -- and rank_signal_magnitude are stored so the API/CLI can explain the ordering
  -- without re-deriving it from evidence.
  rank_score            numeric NOT NULL,
  rank_score_input      text    NOT NULL CHECK (rank_score_input IN ('drop_vs_own_median_pct','discount_vs_median_pct','value_z_score')),
  rank_signal_magnitude numeric NOT NULL,

  evidence         jsonb   NOT NULL,        -- §3.3 shape, exactly (nulls present, never omitted)
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_market_signal UNIQUE (snapshot_date, signal_type, signal_window, catalog_id, market)
);

CREATE INDEX IF NOT EXISTS idx_market_signals_date_type
  ON public.market_signals (snapshot_date DESC, signal_type);
CREATE INDEX IF NOT EXISTS idx_market_signals_origin
  ON public.market_signals (snapshot_date DESC, origin);

COMMENT ON TABLE public.market_signals IS
  'Daily actionable value-signal feed (Market Index Decision Surface, ADR-008 §4.1). '
  'One row per active signal per (snapshot_date, signal_type, signal_window, catalog_id, market). '
  'Written by compute_market_signals(); read by /v1/market/signals. '
  'PREMIUM: service-role read only — entitlement is enforced in the API layer, not RLS.';
COMMENT ON COLUMN public.market_signals.signal_window IS
  'Trailing window a price_drop was computed against (7d|30d); n/a for below_market/value_quality. '
  'A lot may qualify in one window but not the other, so windows are distinct rows. '
  'NOT NULL with an n/a sentinel keeps it usable inside uq_market_signal without NULL-distinctness surprises.';
COMMENT ON COLUMN public.market_signals.process IS
  'Normalized processing_base_method bucket, coalescing missing metadata to undisclosed BEFORE write. '
  'Never NULL: keeps unknown-process lots distinct from the all-process rollup (process: null in aggregate responses only).';
COMMENT ON COLUMN public.market_signals.origin IS
  'Denormalized coffee_catalog.country (aliased origin). Nullable — the job denormalizes whatever is present. '
  'A NULL origin can still emit price_drop (own-history) but never below_market/value_quality (need a real segment benchmark).';
COMMENT ON COLUMN public.market_signals.rank_score IS
  'Ordering key: rank_signal_magnitude * (1 + greatest(coalesce(score_value,84)-84,0)/10). '
  'rank_score_input names the driving field; rank_signal_magnitude is its absolute magnitude.';
COMMENT ON COLUMN public.market_signals.evidence IS
  'Exact §3.3 evidence object. Fields irrelevant to a signal type are null, never omitted (stable shape for agents).';

-- ============================================================
-- PART 2: metadata_index_snapshots (§4.2)
-- One row per (period, origin-or-market-wide, market, dimension, bucket).
-- Mirrors the price_index_snapshots pattern. Written by compute_metadata_index().
-- ============================================================

CREATE TABLE IF NOT EXISTS public.metadata_index_snapshots (
  id             bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_start   date    NOT NULL,           -- week (Monday) or month (1st)
  grain          text    NOT NULL CHECK (grain IN ('week','month')),
  origin         text,                        -- NULL = market-wide
  market         text    NOT NULL CHECK (market IN ('retail','wholesale','all')),
  dimension      text    NOT NULL CHECK (dimension IN ('process','disclosure','score')),
  bucket         text    NOT NULL,            -- e.g. 'Washed', 'label_only', 'p50'
  lot_count      integer NOT NULL,
  share          numeric,                     -- NULL for dimension='score'
  stat_value     numeric,                     -- NULL except dimension='score' (bucket p25|p50|p75 -> value)
  supplier_count integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Table-level UNIQUE cannot span expressions like COALESCE(origin,''), so the
-- market-wide (origin IS NULL) vs origin-level uniqueness is enforced by an
-- expression unique index (equivalent to UNIQUE NULLS NOT DISTINCT on PG15+).
CREATE UNIQUE INDEX IF NOT EXISTS uq_metadata_index
  ON public.metadata_index_snapshots (period_start, grain, COALESCE(origin, ''), market, dimension, bucket);

CREATE INDEX IF NOT EXISTS idx_metadata_index_dim_period
  ON public.metadata_index_snapshots (dimension, grain, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_metadata_index_origin
  ON public.metadata_index_snapshots (dimension, COALESCE(origin, ''), period_start DESC);

COMMENT ON TABLE public.metadata_index_snapshots IS
  'Metadata-trend index (ADR-008 §4.2): process-mix, disclosure-level, and score-distribution trends over time. '
  'One row per (period_start, grain, origin|market-wide, market, dimension, bucket). '
  'Written by compute_metadata_index() (backfillable to 2026-03-21); read by /v1/market/metadata-index. '
  'PREMIUM: service-role read only — the public process-mix slice is exposed only through the API entitlement layer.';
COMMENT ON COLUMN public.metadata_index_snapshots.origin IS 'NULL = market-wide (no origin filter). Origin-level rows suppressed when lot_count < 5.';
COMMENT ON COLUMN public.metadata_index_snapshots.share IS 'Mean-of-daily-shares over the period. NULL for dimension=score.';
COMMENT ON COLUMN public.metadata_index_snapshots.stat_value IS 'Price-free score statistic for dimension=score buckets (p25|p50|p75). NULL otherwise.';

-- ============================================================
-- PART 3: price_index_move_stats (D2 — precompute)
-- Movement-significance stats, one row per
-- (snapshot_date, origin|NULL, process|NULL, market, move_window, baseline_weeks).
-- Precomputed so /v1/price-index/stats is a thin reader instead of heavy
-- per-request window math over service-role REST (see build-plan F3/D2).
-- NULL origin = market-wide; NULL process = all-process rollup.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.price_index_move_stats (
  id                       bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  snapshot_date            date    NOT NULL,
  origin                   text,                    -- NULL = market-wide
  process                  text,                    -- NULL = all-process rollup
  market                   text    NOT NULL CHECK (market IN ('retail','wholesale','all')),
  move_window              text    NOT NULL CHECK (move_window IN ('7d','30d')),
  baseline_weeks           integer NOT NULL,

  -- Signed direction fields
  latest_move_pct          numeric,
  baseline_mean_move_pct   numeric,
  z_score                  numeric,

  -- Absolute-magnitude significance fields
  move_percentile          numeric,
  weeks_since_larger_move  integer,
  classification           text CHECK (classification IS NULL OR classification IN ('quiet','normal','notable','exceptional')),
  baseline_stddev          numeric,

  -- Repricing vs mix-shift decomposition
  matched_lot_move_pct     numeric,
  matched_lot_count        integer,
  move_driver              text CHECK (move_driver IS NULL OR move_driver IN ('repricing','mix_shift','mixed','insufficient_overlap')),

  sample_size              integer,
  supplier_count           integer,
  available_baseline_weeks integer,
  note                     text,                    -- e.g. 'insufficient_baseline_history'
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_index_move_stats
  ON public.price_index_move_stats (
    snapshot_date, COALESCE(origin, ''), COALESCE(process, ''), market, move_window, baseline_weeks
  );

CREATE INDEX IF NOT EXISTS idx_price_index_move_stats_date
  ON public.price_index_move_stats (snapshot_date DESC, market, move_window);

COMMENT ON TABLE public.price_index_move_stats IS
  'Precomputed movement-significance stats for /v1/price-index/stats (build-plan D2). '
  'One row per (snapshot_date, origin|market-wide, process|all-process, market, move_window, baseline_weeks). '
  'Keeps the endpoint a thin reader instead of heavy window math over service-role REST. '
  'PREMIUM: service-role read only — only the designated no-origin/no-process/market=retail public summary is exposed via the API layer.';
COMMENT ON COLUMN public.price_index_move_stats.move_percentile IS
  'Percentile of abs(latest_move_pct) within the baseline distribution of abs move magnitudes. '
  'Drives classification (§3.4). NULL when insufficient_baseline_history.';
COMMENT ON COLUMN public.price_index_move_stats.move_driver IS
  'repricing|mix_shift|mixed|insufficient_overlap (§3.4), from raw index move vs matched-lot move. '
  'insufficient_overlap when matched_lot_count < 8.';

-- ============================================================
-- PART 4: RLS + grants (D4 — service-role read AND write ONLY)
-- These tables carry premium leverage. Do NOT grant SELECT to anon/authenticated
-- and do NOT create a public-read policy. Entitlement is enforced only by the
-- parchment-api layer (ppiAccess / public-slice allow-list). RLS + absent grants
-- guarantee the tables cannot leak even if an endpoint gate is bypassed.
-- ============================================================

ALTER TABLE public.market_signals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_index_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_index_move_stats    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['market_signals','metadata_index_snapshots','price_index_move_stats']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = format('Service role all %s', t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        format('Service role all %s', t), t
      );
    END IF;
  END LOOP;
END
$$;

-- Grants: service_role ONLY. No anon/authenticated SELECT (premium tables).
GRANT ALL ON public.market_signals            TO service_role;
GRANT ALL ON public.metadata_index_snapshots  TO service_role;
GRANT ALL ON public.price_index_move_stats    TO service_role;

-- Sequence usage for IDENTITY inserts by service role.
GRANT USAGE, SELECT ON SEQUENCE public.market_signals_id_seq            TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.metadata_index_snapshots_id_seq  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.price_index_move_stats_id_seq    TO service_role;

-- Defensive: revoke any inherited PUBLIC/anon/authenticated read that a prior
-- broad grant may have left (no-op if never granted).
REVOKE ALL ON public.market_signals            FROM anon, authenticated;
REVOKE ALL ON public.metadata_index_snapshots  FROM anon, authenticated;
REVOKE ALL ON public.price_index_move_stats    FROM anon, authenticated;

-- ============================================================
-- SUPPLY INDEX BACKFILL: Mark synthetic price_index_snapshots
-- Migration: 20260322_backfill_supply_index.sql
-- Date: 2026-03-22
-- Purpose:
--   Add `synthetic` boolean column to price_index_snapshots so
--   backfilled historical rows (derived from coffee_catalog
--   stocked_date/unstocked_date) are distinguishable from real
--   daily scraper-computed snapshots.
-- ============================================================

-- Add synthetic column (default false = real scraper data)
ALTER TABLE public.price_index_snapshots
  ADD COLUMN IF NOT EXISTS synthetic boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.price_index_snapshots.synthetic IS
  'True = row was backfilled from coffee_catalog stocked_date/unstocked_date data. '
  'False (default) = row was computed by compute_price_index() from real daily scraper snapshots. '
  'Synthetic rows use current cost_lb as a historical price approximation. '
  'Created by scripts/backfill-supply-index.ts on 2026-03-22.';

-- Update the unique index to include the synthetic flag so real rows and
-- synthetic rows for the same segment/date don't conflict.
-- Drop and recreate with synthetic included.
DROP INDEX IF EXISTS uq_ppi_segment_date;

CREATE UNIQUE INDEX uq_ppi_segment_date
ON public.price_index_snapshots (
  snapshot_date,
  origin,
  COALESCE(process, ''),
  COALESCE(grade, ''),
  wholesale_only,
  synthetic
);

-- Grant: service_role needs to write synthetic rows (same as existing grant)
-- Already granted via "GRANT ALL ON public.price_index_snapshots TO service_role;"
-- in 20260321_price_snapshots.sql — no new grants needed.

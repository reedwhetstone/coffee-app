-- ADR-005 Step 1: additive catalog origin schema fields
-- All columns nullable; no existing columns removed or renamed.
-- appellations deferred until canonical vocabulary and write guard are ready.

ALTER TABLE public.coffee_catalog
  ADD COLUMN IF NOT EXISTS subregion             text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS locality              text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS site                  text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS processing_site       text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS farmer                text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cooperative           text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elevation_min_masl    integer     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elevation_max_masl    integer     DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.coffee_catalog_origin_actor_evidence (
  coffee_catalog_id integer PRIMARY KEY REFERENCES public.coffee_catalog(id) ON DELETE CASCADE,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.coffee_catalog_origin_actor_evidence FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.coffee_catalog_origin_actor_evidence TO service_role;

ALTER TABLE public.coffee_catalog_origin_actor_evidence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coffee_catalog_origin_actor_evidence'
      AND policyname = 'Service role full access for catalog origin actor evidence'
  ) THEN
    CREATE POLICY "Service role full access for catalog origin actor evidence"
    ON public.coffee_catalog_origin_actor_evidence FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Elevation bounds checks. Postgres has no ADD CONSTRAINT IF NOT EXISTS, so guard
-- each constraint with a catalog lookup to keep the migration idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_elevation_min_masl_check'
  ) THEN
    ALTER TABLE public.coffee_catalog
      ADD CONSTRAINT coffee_catalog_elevation_min_masl_check
      CHECK (elevation_min_masl IS NULL OR (elevation_min_masl >= 0 AND elevation_min_masl <= 6000));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_elevation_max_masl_check'
  ) THEN
    ALTER TABLE public.coffee_catalog
      ADD CONSTRAINT coffee_catalog_elevation_max_masl_check
      CHECK (elevation_max_masl IS NULL OR (elevation_max_masl >= 0 AND elevation_max_masl <= 6000));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_elevation_range_check'
  ) THEN
    ALTER TABLE public.coffee_catalog
      ADD CONSTRAINT coffee_catalog_elevation_range_check
      CHECK (elevation_min_masl IS NULL OR elevation_max_masl IS NULL OR elevation_min_masl <= elevation_max_masl);
  END IF;
END $$;

COMMENT ON COLUMN public.coffee_catalog.subregion IS 'ADR-005: geographic subregion within region. Nullable; populated only by opted-in source ports.';
COMMENT ON COLUMN public.coffee_catalog.locality IS 'ADR-005: locality/town within subregion. Nullable; populated only by opted-in source ports.';
COMMENT ON COLUMN public.coffee_catalog.site IS 'ADR-005: specific farm/estate/washing-station site. Nullable; populated only by opted-in source ports.';
COMMENT ON COLUMN public.coffee_catalog.processing_site IS 'ADR-005: processing/mill site when distinct from growing site. Nullable; populated only by opted-in source ports.';
COMMENT ON COLUMN public.coffee_catalog.farmer IS 'ADR-005: named producer/farmer actor. Nullable; populated only by opted-in source ports.';
COMMENT ON COLUMN public.coffee_catalog.cooperative IS 'ADR-005: cooperative/association actor. Nullable; populated only by opted-in source ports.';
COMMENT ON COLUMN public.coffee_catalog.elevation_min_masl IS 'ADR-005: minimum growing elevation in meters above sea level (0-6000). Nullable.';
COMMENT ON COLUMN public.coffee_catalog.elevation_max_masl IS 'ADR-005: maximum growing elevation in meters above sea level (0-6000). Nullable.';
COMMENT ON TABLE public.coffee_catalog_origin_actor_evidence IS 'ADR-005: private structured evidence trail for origin/actor extraction. Service-role only; not part of public catalog projections.';
COMMENT ON COLUMN public.coffee_catalog_origin_actor_evidence.evidence IS 'ADR-005: raw origin/actor extraction evidence (method, source field, confidence). Write-deferred until source ports opt in.';

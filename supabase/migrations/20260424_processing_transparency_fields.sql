-- Add structured processing transparency fields to coffee_catalog.
-- This migration is additive and preserves the legacy processing text field.
-- Run in production only after review. It has not been executed by this PR.

ALTER TABLE public.coffee_catalog
  ADD COLUMN IF NOT EXISTS processing_base_method text,
  ADD COLUMN IF NOT EXISTS fermentation_type text,
  ADD COLUMN IF NOT EXISTS process_additives text[],
  ADD COLUMN IF NOT EXISTS process_additive_detail text,
  ADD COLUMN IF NOT EXISTS fermentation_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS processing_notes text,
  ADD COLUMN IF NOT EXISTS processing_disclosure_level text,
  ADD COLUMN IF NOT EXISTS processing_confidence numeric,
  ADD COLUMN IF NOT EXISTS processing_evidence jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_fermentation_duration_hours_nonnegative'
      AND conrelid = 'public.coffee_catalog'::regclass
  ) THEN
    ALTER TABLE public.coffee_catalog
      ADD CONSTRAINT coffee_catalog_fermentation_duration_hours_nonnegative
      CHECK (fermentation_duration_hours IS NULL OR fermentation_duration_hours >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_processing_confidence_unit_interval'
      AND conrelid = 'public.coffee_catalog'::regclass
  ) THEN
    ALTER TABLE public.coffee_catalog
      ADD CONSTRAINT coffee_catalog_processing_confidence_unit_interval
      CHECK (processing_confidence IS NULL OR (processing_confidence >= 0 AND processing_confidence <= 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_processing_disclosure_level_known'
      AND conrelid = 'public.coffee_catalog'::regclass
  ) THEN
    ALTER TABLE public.coffee_catalog
      ADD CONSTRAINT coffee_catalog_processing_disclosure_level_known
      CHECK (
        processing_disclosure_level IS NULL
        OR processing_disclosure_level IN ('none', 'label_only', 'structured', 'narrative', 'high_detail')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.coffee_catalog.processing IS
  'Legacy supplier/display processing label. Preserve for compatibility and broad text search.';
COMMENT ON COLUMN public.coffee_catalog.processing_base_method IS
  'Normalized base processing bucket such as Washed, Natural, Honey, Wet-Hulled, Decaf, Other, or Unknown. Null means not yet extracted.';
COMMENT ON COLUMN public.coffee_catalog.fermentation_type IS
  'Normalized fermentation environment or technique such as Aerobic, Anaerobic, Carbonic Maceration, Yeast Inoculated, Co-Fermented, None Stated, or Unknown.';
COMMENT ON COLUMN public.coffee_catalog.process_additives IS
  'Disclosed fermentation/process inputs. Use none only for explicit none; use unspecified when the source does not disclose enough detail. Do not infer additives from tasting notes alone.';
COMMENT ON COLUMN public.coffee_catalog.process_additive_detail IS
  'Free-text detail for named disclosed additives or starter cultures, for example hops, mandarin, wine yeast, or coffee mossto.';
COMMENT ON COLUMN public.coffee_catalog.fermentation_duration_hours IS
  'Fermentation duration in hours when explicitly stated or safely converted from days.';
COMMENT ON COLUMN public.coffee_catalog.processing_notes IS
  'Concise normalized human-readable processing note. Not marketing copy.';
COMMENT ON COLUMN public.coffee_catalog.processing_disclosure_level IS
  'Supplier disclosure quality: none, label_only, structured, narrative, or high_detail.';
COMMENT ON COLUMN public.coffee_catalog.processing_confidence IS
  '0 to 1 confidence score for the structured processing breakdown.';
COMMENT ON COLUMN public.coffee_catalog.processing_evidence IS
  'Internal provenance envelope for structured processing extraction. Public API surfaces expose evidence_available rather than raw quotes by default.';

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_processing_base_method
  ON public.coffee_catalog(processing_base_method);

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_fermentation_type
  ON public.coffee_catalog(fermentation_type);

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_processing_disclosure_level
  ON public.coffee_catalog(processing_disclosure_level);

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_processing_confidence
  ON public.coffee_catalog(processing_confidence);

CREATE INDEX IF NOT EXISTS idx_coffee_catalog_process_additives
  ON public.coffee_catalog USING gin(process_additives);

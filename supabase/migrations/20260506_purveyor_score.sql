-- Purveyor Score: deterministic listing-intelligence metadata score.
-- This is not a coffee quality score, supplier verification, certification, or
-- regulatory assurance. It rewards structured, comparable catalog metadata.

ALTER TABLE public.coffee_catalog
	ADD COLUMN IF NOT EXISTS purveyor_score integer,
	ADD COLUMN IF NOT EXISTS purveyor_score_confidence numeric,
	ADD COLUMN IF NOT EXISTS purveyor_score_tier text,
	ADD COLUMN IF NOT EXISTS purveyor_score_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
	ADD COLUMN IF NOT EXISTS purveyor_score_version text NOT NULL DEFAULT 'purveyor-score-v1',
	ADD COLUMN IF NOT EXISTS purveyor_score_updated_at timestamptz;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_purveyor_score_range'
	) THEN
		ALTER TABLE public.coffee_catalog
			ADD CONSTRAINT coffee_catalog_purveyor_score_range
			CHECK (purveyor_score IS NULL OR (purveyor_score >= 0 AND purveyor_score <= 100));
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_purveyor_score_confidence_range'
	) THEN
		ALTER TABLE public.coffee_catalog
			ADD CONSTRAINT coffee_catalog_purveyor_score_confidence_range
			CHECK (
				purveyor_score_confidence IS NULL OR
				(purveyor_score_confidence >= 0 AND purveyor_score_confidence <= 1)
			);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'coffee_catalog_purveyor_score_tier_allowed'
	) THEN
		ALTER TABLE public.coffee_catalog
			ADD CONSTRAINT coffee_catalog_purveyor_score_tier_allowed
			CHECK (
				purveyor_score_tier IS NULL OR
				purveyor_score_tier = ANY (
					ARRAY['Exceptional'::text, 'Strong'::text, 'Developing'::text, 'Limited'::text, 'Unscored'::text]
				)
			);
	END IF;
END $$;

CREATE OR REPLACE FUNCTION public.purveyor_score_has_text(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT value IS NOT NULL
		AND btrim(value) <> ''
		AND lower(btrim(value)) NOT IN (
			'unknown',
			'none stated',
			'not stated',
			'not specified',
			'unspecified',
			'n/a',
			'na',
			'null'
		);
$$;

CREATE OR REPLACE FUNCTION public.compute_purveyor_score(item public.coffee_catalog)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
	provenance integer := 0;
	process integer := 0;
	freshness integer := 0;
	pricing integer := 0;
	sensory integer := 0;
	total integer := 0;
	confidence numeric := 0;
	tier text := 'Unscored';
	tier_count integer := 0;
	has_tasting boolean := false;
	has_process_evidence boolean := false;
	structured_signal_count integer := 0;
	recent_signal_count integer := 0;
BEGIN
	-- Provenance depth, max 25.
	IF public.purveyor_score_has_text(item.country) THEN provenance := provenance + 5; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.region) THEN provenance := provenance + 5; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.farm_notes) THEN provenance := provenance + 7; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.cultivar_detail) THEN provenance := provenance + 5; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.grade) OR public.purveyor_score_has_text(item.appearance) THEN provenance := provenance + 3; END IF;
	provenance := LEAST(provenance, 25);

	-- Process transparency, max 25.
	IF public.purveyor_score_has_text(item.processing_base_method) THEN process := process + 6; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.fermentation_type) THEN process := process + 4; structured_signal_count := structured_signal_count + 1; END IF;
	IF item.process_additives IS NOT NULL AND array_length(item.process_additives, 1) > 0 THEN process := process + 3; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.drying_method) THEN process := process + 4; structured_signal_count := structured_signal_count + 1; END IF;
	IF item.fermentation_duration_hours IS NOT NULL AND item.fermentation_duration_hours > 0 THEN process := process + 3; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.processing_disclosure_level) THEN process := process + 3; structured_signal_count := structured_signal_count + 1; END IF;
	IF item.processing_confidence IS NOT NULL AND item.processing_confidence >= 0.6 THEN process := process + 2; END IF;
	process := LEAST(process, 25);

	-- Freshness and availability, max 20.
	IF item.stocked IS NOT NULL THEN freshness := freshness + 5; structured_signal_count := structured_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.stocked_date::text) THEN freshness := freshness + 6; recent_signal_count := recent_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.arrival_date) THEN freshness := freshness + 6; recent_signal_count := recent_signal_count + 1; END IF;
	IF public.purveyor_score_has_text(item.last_updated::text) THEN freshness := freshness + 3; recent_signal_count := recent_signal_count + 1; END IF;
	freshness := LEAST(freshness, 20);

	-- Pricing comparability, max 15.
	IF item.price_per_lb IS NOT NULL OR item.cost_lb IS NOT NULL THEN pricing := pricing + 6; structured_signal_count := structured_signal_count + 1; END IF;
	IF item.price_tiers IS NOT NULL THEN
		tier_count := COALESCE(array_length(item.price_tiers, 1), 0);
		IF tier_count > 1 THEN
			pricing := pricing + 6;
		ELSIF tier_count = 1 THEN
			pricing := pricing + 3;
		END IF;
		structured_signal_count := structured_signal_count + 1;
	END IF;
	IF item.wholesale IS NOT NULL THEN pricing := pricing + 3; END IF;
	pricing := LEAST(pricing, 15);

	-- Sensory context, max 15.
	has_tasting :=
		item.ai_tasting_notes IS NOT NULL OR
		public.purveyor_score_has_text(item.cupping_notes) OR
		public.purveyor_score_has_text(item.ai_description);
	IF has_tasting THEN sensory := sensory + 6; END IF;
	IF item.score_value IS NOT NULL THEN sensory := sensory + 4; END IF;
	IF public.purveyor_score_has_text(item.roast_recs) THEN sensory := sensory + 3; END IF;
	IF public.purveyor_score_has_text(item.description_short) OR public.purveyor_score_has_text(item.description_long) THEN sensory := sensory + 2; END IF;
	sensory := LEAST(sensory, 15);

	total := LEAST(100, provenance + process + freshness + pricing + sensory);

	IF total >= 85 THEN tier := 'Exceptional';
	ELSIF total >= 70 THEN tier := 'Strong';
	ELSIF total >= 50 THEN tier := 'Developing';
	ELSIF total > 0 THEN tier := 'Limited';
	ELSE tier := 'Unscored';
	END IF;

	has_process_evidence := item.processing_evidence IS NOT NULL;
	confidence :=
		LEAST(
			1,
			0.2
			+ LEAST(structured_signal_count, 10) * 0.045
			+ recent_signal_count * 0.05
			+ COALESCE(item.processing_confidence, 0) * 0.15
			+ CASE WHEN has_process_evidence THEN 0.1 ELSE 0 END
		);

	RETURN jsonb_build_object(
		'score', total,
		'tier', tier,
		'confidence', round(confidence, 2),
		'version', 'purveyor-score-v1',
		'factors', jsonb_build_object(
			'provenance_depth', provenance,
			'process_transparency', process,
			'freshness_availability', freshness,
			'pricing_comparability', pricing,
			'sensory_context', sensory,
			'confidence_signals', jsonb_build_object(
				'structured_signal_count', structured_signal_count,
				'recent_signal_count', recent_signal_count,
				'processing_confidence', item.processing_confidence,
				'processing_evidence_available', has_process_evidence
			)
		)
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_purveyor_score_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	computed jsonb;
BEGIN
	computed := public.compute_purveyor_score(NEW);
	NEW.purveyor_score := (computed->>'score')::integer;
	NEW.purveyor_score_tier := computed->>'tier';
	NEW.purveyor_score_confidence := (computed->>'confidence')::numeric;
	NEW.purveyor_score_factors := computed->'factors';
	NEW.purveyor_score_version := computed->>'version';
	NEW.purveyor_score_updated_at := now();
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_purveyor_score_fields_on_catalog ON public.coffee_catalog;

CREATE TRIGGER set_purveyor_score_fields_on_catalog
BEFORE INSERT OR UPDATE OF
	country,
	region,
	farm_notes,
	cultivar_detail,
	grade,
	appearance,
	processing_base_method,
	fermentation_type,
	process_additives,
	process_additive_detail,
	fermentation_duration_hours,
	drying_method,
	processing_notes,
	processing_disclosure_level,
	processing_confidence,
	processing_evidence,
	stocked,
	stocked_date,
	arrival_date,
	last_updated,
	price_per_lb,
	cost_lb,
	price_tiers,
	wholesale,
	ai_tasting_notes,
	cupping_notes,
	ai_description,
	score_value,
	roast_recs,
	description_short,
	description_long
ON public.coffee_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_purveyor_score_fields();

UPDATE public.coffee_catalog
SET
	purveyor_score = (public.compute_purveyor_score(coffee_catalog)->>'score')::integer,
	purveyor_score_tier = public.compute_purveyor_score(coffee_catalog)->>'tier',
	purveyor_score_confidence = (public.compute_purveyor_score(coffee_catalog)->>'confidence')::numeric,
	purveyor_score_factors = public.compute_purveyor_score(coffee_catalog)->'factors',
	purveyor_score_version = public.compute_purveyor_score(coffee_catalog)->>'version',
	purveyor_score_updated_at = now();

COMMENT ON COLUMN public.coffee_catalog.purveyor_score IS
	'Purveyors-computed listing intelligence score from metadata completeness and buyer-useful disclosure signals. Not cup quality, certification, or supplier verification.';
COMMENT ON COLUMN public.coffee_catalog.purveyor_score_confidence IS
	'0 to 1 confidence for the Purveyor Score inputs based on structured metadata, recency, and evidence signals.';
COMMENT ON COLUMN public.coffee_catalog.purveyor_score_factors IS
	'Breakdown of Purveyor Score v1 factor contributions and confidence signals.';
COMMENT ON FUNCTION public.compute_purveyor_score(public.coffee_catalog) IS
	'Computes Purveyor Score v1 from normalized coffee_catalog metadata.';

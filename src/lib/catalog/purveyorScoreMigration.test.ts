import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSql(relativePath: string): string {
	return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const migrationSql = readSql('supabase/migrations/20260506_purveyor_score.sql');

describe('Purveyor Score migration SQL contract', () => {
	it('stores the score, confidence, tier, factors, version, and timestamp on coffee_catalog', () => {
		expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS purveyor_score integer');
		expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS purveyor_score_confidence numeric');
		expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS purveyor_score_tier text');
		expect(migrationSql).toContain(
			"ADD COLUMN IF NOT EXISTS purveyor_score_factors jsonb NOT NULL DEFAULT '{}'::jsonb"
		);
		expect(migrationSql).toContain(
			"ADD COLUMN IF NOT EXISTS purveyor_score_version text NOT NULL DEFAULT 'purveyor-score-v1'"
		);
		expect(migrationSql).toContain(
			'ADD COLUMN IF NOT EXISTS purveyor_score_updated_at timestamptz'
		);
	});

	it('keeps range and tier constraints explicit and scoped to coffee_catalog', () => {
		expect(migrationSql).toContain('coffee_catalog_purveyor_score_range');
		expect(migrationSql).toContain('purveyor_score >= 0 AND purveyor_score <= 100');
		expect(migrationSql).toContain('coffee_catalog_purveyor_score_confidence_range');
		expect(migrationSql).toContain(
			'purveyor_score_confidence >= 0 AND purveyor_score_confidence <= 1'
		);
		expect(migrationSql).toContain(
			"ARRAY['Exceptional'::text, 'Strong'::text, 'Developing'::text, 'Limited'::text, 'Unscored'::text]"
		);
		expect(migrationSql.match(/conrelid = 'public\.coffee_catalog'::regclass/g)).toHaveLength(3);
	});

	it('computes score dimensions and confidence separately', () => {
		for (const factor of [
			'provenance_depth',
			'process_transparency',
			'freshness_availability',
			'pricing_comparability',
			'sensory_context',
			'confidence_signals'
		]) {
			expect(migrationSql).toContain(factor);
		}

		expect(migrationSql).toContain("IF total >= 85 THEN tier := 'Exceptional'");
		expect(migrationSql).toContain("ELSIF total >= 70 THEN tier := 'Strong'");
		expect(migrationSql).toContain("ELSIF total >= 50 THEN tier := 'Developing'");
		expect(migrationSql).toContain("ELSIF total > 0 THEN tier := 'Limited'");
		expect(migrationSql).toContain("ELSE tier := 'Unscored'");
		expect(migrationSql).toContain('COALESCE(item.processing_confidence, 0) * 0.15');
		expect(migrationSql).toContain('CASE WHEN has_process_evidence THEN 0.1 ELSE 0 END');
	});

	it('matches app scoring semantics for positive numeric and price-tier inputs', () => {
		expect(migrationSql).toContain('IF item.price_per_lb > 0 OR item.cost_lb > 0 THEN');
		expect(migrationSql).toContain('IF item.score_value > 0 THEN sensory := sensory + 4; END IF;');
		expect(migrationSql).toContain('jsonb_array_length(to_jsonb(item.price_tiers))');
	});

	it('updates scores through a trigger on relevant metadata columns and backfills existing rows', () => {
		expect(migrationSql).toContain('CREATE TRIGGER set_purveyor_score_fields_on_catalog');
		expect(migrationSql).toContain('BEFORE INSERT OR UPDATE OF');

		for (const column of [
			'country',
			'processing_base_method',
			'processing_confidence',
			'processing_evidence_available',
			'stocked_date',
			'price_tiers',
			'ai_tasting_notes',
			'score_value',
			'roast_recs',
			'purveyor_score',
			'purveyor_score_confidence',
			'purveyor_score_tier',
			'purveyor_score_factors',
			'purveyor_score_version',
			'purveyor_score_updated_at'
		]) {
			expect(migrationSql).toContain(column);
		}

		expect(migrationSql).toContain('UPDATE public.coffee_catalog');
		expect(migrationSql).toContain('public.compute_purveyor_score(coffee_catalog)');
	});

	it('documents the score guardrail in SQL comments', () => {
		expect(migrationSql).toContain('Not cup quality, certification, or supplier verification');
		expect(migrationSql).toContain('metadata completeness and buyer-useful disclosure signals');
	});
});

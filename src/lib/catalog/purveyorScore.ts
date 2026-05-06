import type { CoffeeCatalog } from '$lib/types/component.types';

export const PURVEYOR_SCORE_VERSION = 'purveyor-score-v1';

export type PurveyorScoreTier = 'Exceptional' | 'Strong' | 'Developing' | 'Limited' | 'Unscored';

export interface PurveyorScoreFactors {
	provenance_depth: number;
	process_transparency: number;
	freshness_availability: number;
	pricing_comparability: number;
	sensory_context: number;
	confidence_signals: {
		structured_signal_count: number;
		recent_signal_count: number;
		processing_confidence: number | null;
		processing_evidence_available: boolean;
	};
}

export interface PurveyorScoreSummary {
	score: number;
	tier: PurveyorScoreTier;
	confidence: number;
	factors: PurveyorScoreFactors;
	version: string;
}

const PLACEHOLDER_VALUES = new Set([
	'',
	'unknown',
	'none stated',
	'not stated',
	'not specified',
	'unspecified',
	'n/a',
	'na',
	'null'
]);

function hasText(value: string | null | undefined): boolean {
	if (typeof value !== 'string') return false;
	const trimmed = value.trim();
	return Boolean(trimmed) && !PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

function hasPositiveNumber(value: number | null | undefined): boolean {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function getPriceTierCount(priceTiers: unknown): number {
	if (!priceTiers) return 0;
	if (Array.isArray(priceTiers)) return priceTiers.length;
	if (typeof priceTiers !== 'string') return 0;
	try {
		const parsed = JSON.parse(priceTiers);
		return Array.isArray(parsed) ? parsed.length : 0;
	} catch {
		return 0;
	}
}

function getTier(score: number): PurveyorScoreTier {
	if (score >= 85) return 'Exceptional';
	if (score >= 70) return 'Strong';
	if (score >= 50) return 'Developing';
	if (score > 0) return 'Limited';
	return 'Unscored';
}

function roundConfidence(value: number): number {
	return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function coerceFactors(value: unknown): PurveyorScoreFactors | null {
	if (!value || typeof value !== 'object') return null;
	const factors = value as Partial<PurveyorScoreFactors>;
	if (
		typeof factors.provenance_depth !== 'number' ||
		typeof factors.process_transparency !== 'number' ||
		typeof factors.freshness_availability !== 'number' ||
		typeof factors.pricing_comparability !== 'number' ||
		typeof factors.sensory_context !== 'number'
	) {
		return null;
	}
	const confidence = factors.confidence_signals ?? {
		structured_signal_count: 0,
		recent_signal_count: 0,
		processing_confidence: null,
		processing_evidence_available: false
	};
	return {
		provenance_depth: factors.provenance_depth,
		process_transparency: factors.process_transparency,
		freshness_availability: factors.freshness_availability,
		pricing_comparability: factors.pricing_comparability,
		sensory_context: factors.sensory_context,
		confidence_signals: {
			structured_signal_count:
				typeof confidence.structured_signal_count === 'number'
					? confidence.structured_signal_count
					: 0,
			recent_signal_count:
				typeof confidence.recent_signal_count === 'number' ? confidence.recent_signal_count : 0,
			processing_confidence:
				typeof confidence.processing_confidence === 'number'
					? confidence.processing_confidence
					: null,
			processing_evidence_available: confidence.processing_evidence_available === true
		}
	};
}

export function calculatePurveyorScore(coffee: CoffeeCatalog): PurveyorScoreSummary {
	let provenance = 0;
	let process = 0;
	let freshness = 0;
	let pricing = 0;
	let sensory = 0;
	let structuredSignalCount = 0;
	let recentSignalCount = 0;

	const addStructured = () => {
		structuredSignalCount += 1;
	};

	if (hasText(coffee.country)) {
		provenance += 5;
		addStructured();
	}
	if (hasText(coffee.region)) {
		provenance += 5;
		addStructured();
	}
	if (hasText(coffee.farm_notes)) {
		provenance += 7;
		addStructured();
	}
	if (hasText(coffee.cultivar_detail)) {
		provenance += 5;
		addStructured();
	}
	if (hasText(coffee.grade) || hasText(coffee.appearance)) provenance += 3;
	provenance = Math.min(provenance, 25);

	if (hasText(coffee.processing_base_method)) {
		process += 6;
		addStructured();
	}
	if (hasText(coffee.fermentation_type)) {
		process += 4;
		addStructured();
	}
	if (coffee.process_additives && coffee.process_additives.length > 0) {
		process += 3;
		addStructured();
	}
	if (hasText(coffee.drying_method)) {
		process += 4;
		addStructured();
	}
	if (hasPositiveNumber(coffee.fermentation_duration_hours)) {
		process += 3;
		addStructured();
	}
	if (hasText(coffee.processing_disclosure_level)) {
		process += 3;
		addStructured();
	}
	if (typeof coffee.processing_confidence === 'number' && coffee.processing_confidence >= 0.6) {
		process += 2;
	}
	process = Math.min(process, 25);

	if (coffee.stocked !== null && coffee.stocked !== undefined) {
		freshness += 5;
		addStructured();
	}
	if (hasText(coffee.stocked_date)) {
		freshness += 6;
		recentSignalCount += 1;
	}
	if (hasText(coffee.arrival_date)) {
		freshness += 6;
		recentSignalCount += 1;
	}
	if (hasText(coffee.last_updated)) {
		freshness += 3;
		recentSignalCount += 1;
	}
	freshness = Math.min(freshness, 20);

	if (hasPositiveNumber(coffee.price_per_lb) || hasPositiveNumber(coffee.cost_lb)) {
		pricing += 6;
		addStructured();
	}
	const tierCount = getPriceTierCount(coffee.price_tiers);
	if (tierCount > 1) pricing += 6;
	else if (tierCount === 1) pricing += 3;
	if (tierCount > 0) addStructured();
	if (coffee.wholesale !== null && coffee.wholesale !== undefined) pricing += 3;
	pricing = Math.min(pricing, 15);

	if (coffee.ai_tasting_notes || hasText(coffee.cupping_notes) || hasText(coffee.ai_description)) {
		sensory += 6;
	}
	if (hasPositiveNumber(coffee.score_value)) sensory += 4;
	if (hasText(coffee.roast_recs)) sensory += 3;
	if (hasText(coffee.description_short) || hasText(coffee.description_long)) sensory += 2;
	sensory = Math.min(sensory, 15);

	const score = Math.min(100, provenance + process + freshness + pricing + sensory);
	const processingEvidenceAvailable = coffee.processing_evidence_available === true;
	const confidence = roundConfidence(
		0.2 +
			Math.min(structuredSignalCount, 10) * 0.045 +
			recentSignalCount * 0.05 +
			(coffee.processing_confidence ?? 0) * 0.15 +
			(processingEvidenceAvailable ? 0.1 : 0)
	);

	return {
		score,
		tier: getTier(score),
		confidence,
		version: PURVEYOR_SCORE_VERSION,
		factors: {
			provenance_depth: provenance,
			process_transparency: process,
			freshness_availability: freshness,
			pricing_comparability: pricing,
			sensory_context: sensory,
			confidence_signals: {
				structured_signal_count: structuredSignalCount,
				recent_signal_count: recentSignalCount,
				processing_confidence: coffee.processing_confidence ?? null,
				processing_evidence_available: processingEvidenceAvailable
			}
		}
	};
}

export function getPurveyorScoreSummary(coffee: CoffeeCatalog): PurveyorScoreSummary {
	if (typeof coffee.purveyor_score === 'number') {
		const factors = coerceFactors(coffee.purveyor_score_factors);
		return {
			score: coffee.purveyor_score,
			tier:
				(coffee.purveyor_score_tier as PurveyorScoreTier | null) ?? getTier(coffee.purveyor_score),
			confidence:
				typeof coffee.purveyor_score_confidence === 'number'
					? coffee.purveyor_score_confidence
					: calculatePurveyorScore(coffee).confidence,
			version: coffee.purveyor_score_version ?? PURVEYOR_SCORE_VERSION,
			factors: factors ?? calculatePurveyorScore(coffee).factors
		};
	}

	return calculatePurveyorScore(coffee);
}

export function formatPurveyorScore(summary: PurveyorScoreSummary): string {
	return `Purveyor Score ${summary.score} · ${summary.tier}`;
}

export type CatalogProofFamilyKey = 'process' | 'provenance' | 'freshness' | 'pricing';

export type CatalogProofFamilyLabel =
	| 'disclosed'
	| 'identified'
	| 'partial'
	| 'dated'
	| 'recently_stocked'
	| 'tiered'
	| 'listed'
	| 'not_available';

export type CatalogProofOverallLabel = 'strong' | 'partial' | 'limited' | 'not_available';

export type CatalogProofLimitation =
	| 'not_certification'
	| 'raw_evidence_not_included'
	| 'supplier_verification_not_performed';

export interface CatalogProofProcessInput {
	base_method?: string | null;
	fermentation_type?: string | null;
	additives?: string[] | null;
	additive_detail?: string | null;
	fermentation_duration_hours?: number | null;
	drying_method?: string | null;
	notes?: string | null;
	disclosure_level?: string | null;
	confidence?: number | null;
	evidence_available?: boolean | null;
}

export interface CatalogProofInput {
	country?: string | null;
	region?: string | null;
	farm_notes?: string | null;
	source?: string | null;
	arrival_date?: string | null;
	stocked_date?: string | null;
	last_updated?: string | null;
	stocked?: boolean | null;
	price_per_lb?: number | null;
	cost_lb?: number | null;
	price_tiers?: unknown;
	wholesale?: boolean | null;
	processing_base_method?: string | null;
	fermentation_type?: string | null;
	process_additives?: string[] | null;
	process_additive_detail?: string | null;
	fermentation_duration_hours?: number | null;
	drying_method?: string | null;
	processing_notes?: string | null;
	processing_disclosure_level?: string | null;
	processing_confidence?: number | null;
	processing_evidence_available?: boolean | null;
	process?: CatalogProofProcessInput | null;
}

export interface CatalogProofFamily {
	label: CatalogProofFamilyLabel;
	confidence: number | null;
	signals: string[];
	message: string;
}

export interface CatalogProofSummary {
	version: 'proof-summary-v1';
	overall: {
		label: CatalogProofOverallLabel;
		families_with_signals: number;
	};
	families: Record<CatalogProofFamilyKey, CatalogProofFamily>;
	limitations: CatalogProofLimitation[];
}

export interface CatalogProofBadge {
	key: string;
	family: CatalogProofFamilyKey;
	label: string;
	title: string;
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

function normalizeSignalText(value: string | null | undefined): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) return null;
	return trimmed;
}

function normalizeConfidence(confidence: number | null | undefined): number | null {
	if (confidence === null || confidence === undefined) return null;
	if (!Number.isFinite(confidence)) return null;
	return Math.min(1, Math.max(0, confidence));
}

function hasPositiveNumber(value: number | null | undefined): boolean {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function parsePriceTierCount(priceTiers: unknown): number {
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

function getProcessInput(item: CatalogProofInput): Required<CatalogProofProcessInput> {
	const process = item.process ?? {};

	return {
		base_method: process.base_method ?? item.processing_base_method ?? null,
		fermentation_type: process.fermentation_type ?? item.fermentation_type ?? null,
		additives: process.additives ?? item.process_additives ?? null,
		additive_detail: process.additive_detail ?? item.process_additive_detail ?? null,
		fermentation_duration_hours:
			process.fermentation_duration_hours ?? item.fermentation_duration_hours ?? null,
		drying_method: process.drying_method ?? item.drying_method ?? null,
		notes: process.notes ?? item.processing_notes ?? null,
		disclosure_level: process.disclosure_level ?? item.processing_disclosure_level ?? null,
		confidence: process.confidence ?? item.processing_confidence ?? null,
		evidence_available: process.evidence_available ?? item.processing_evidence_available ?? null
	};
}

function buildProcessFamily(item: CatalogProofInput): CatalogProofFamily {
	const process = getProcessInput(item);
	const baseMethod = normalizeSignalText(process.base_method);
	const fermentationType = normalizeSignalText(process.fermentation_type);
	const disclosureLevel = normalizeSignalText(process.disclosure_level);
	const dryingMethod = normalizeSignalText(process.drying_method);
	const confidence = normalizeConfidence(process.confidence);
	const hasEvidence = process.evidence_available === true;
	const additives = process.additives?.filter((value) => normalizeSignalText(value)) ?? [];
	const hasAdditiveDetail = normalizeSignalText(process.additive_detail) !== null;
	const hasNotes = normalizeSignalText(process.notes) !== null;
	const hasDuration = hasPositiveNumber(process.fermentation_duration_hours);

	const signals = [
		baseMethod ? 'base_method' : null,
		fermentationType ? 'fermentation_type' : null,
		additives.length > 0 ? 'additives_disclosed' : null,
		hasAdditiveDetail ? 'additive_detail_present' : null,
		hasDuration ? 'fermentation_duration' : null,
		dryingMethod ? 'drying_method' : null,
		disclosureLevel ? 'disclosure_level' : null,
		confidence !== null ? 'confidence_score' : null,
		hasEvidence ? 'evidence_presence' : null,
		hasNotes ? 'process_notes_present' : null
	].filter((signal): signal is string => Boolean(signal));

	if (signals.length === 0) {
		return {
			label: 'not_available',
			confidence: null,
			signals: [],
			message: 'No structured process disclosure signals are available.'
		};
	}

	const disclosed = Boolean(
		baseMethod && (disclosureLevel || hasEvidence || (confidence !== null && confidence >= 0.6))
	);

	return {
		label: disclosed ? 'disclosed' : 'partial',
		confidence,
		signals,
		message: disclosed
			? 'Structured process disclosure signals are present.'
			: 'Some process signals are present, but the summary is incomplete.'
	};
}

function buildProvenanceFamily(item: CatalogProofInput): CatalogProofFamily {
	const hasCountry = normalizeSignalText(item.country) !== null;
	const hasRegion = normalizeSignalText(item.region) !== null;
	const hasFarmNotes = normalizeSignalText(item.farm_notes) !== null;
	const hasSource = normalizeSignalText(item.source) !== null;
	const signals = [
		hasCountry ? 'country' : null,
		hasRegion ? 'region' : null,
		hasFarmNotes ? 'farm_notes_present' : null,
		hasSource ? 'supplier_source' : null
	].filter((signal): signal is string => Boolean(signal));

	if (signals.length === 0) {
		return {
			label: 'not_available',
			confidence: null,
			signals: [],
			message: 'No provenance signals are available.'
		};
	}

	const identified = hasCountry && hasRegion && (hasFarmNotes || hasSource);

	return {
		label: identified ? 'identified' : 'partial',
		confidence: identified ? 0.8 : 0.5,
		signals,
		message: identified
			? 'Origin and supplier-level provenance signals are present.'
			: 'Some provenance signals are present, but the origin summary is incomplete.'
	};
}

function buildFreshnessFamily(item: CatalogProofInput): CatalogProofFamily {
	const hasStockedDate = normalizeSignalText(item.stocked_date) !== null;
	const hasArrivalDate = normalizeSignalText(item.arrival_date) !== null;
	const hasLastUpdated = normalizeSignalText(item.last_updated) !== null;
	const isCurrentlyStocked = item.stocked === true;
	const signals = [
		hasStockedDate ? 'stocked_date' : null,
		hasArrivalDate ? 'arrival_date' : null,
		hasLastUpdated ? 'last_updated' : null,
		isCurrentlyStocked ? 'currently_stocked' : null
	].filter((signal): signal is string => Boolean(signal));

	if (signals.length === 0) {
		return {
			label: 'not_available',
			confidence: null,
			signals: [],
			message: 'No freshness or availability date signals are available.'
		};
	}

	return {
		label: 'dated',
		confidence: hasStockedDate || hasArrivalDate ? 0.75 : 0.45,
		signals,
		message: 'Freshness and availability signals are date-based, not recency or quality claims.'
	};
}

function buildPricingFamily(item: CatalogProofInput): CatalogProofFamily {
	const hasPrice = hasPositiveNumber(item.price_per_lb) || hasPositiveNumber(item.cost_lb);
	const tierCount = parsePriceTierCount(item.price_tiers);
	const hasTiers = tierCount > 1;
	const hasSingleTier = tierCount === 1;
	const hasWholesaleClassification =
		(hasPrice || hasTiers || hasSingleTier) &&
		(item.wholesale === true || item.wholesale === false);
	const signals = [
		hasPrice ? 'price_per_lb' : null,
		hasTiers ? 'price_tiers' : null,
		hasSingleTier ? 'single_price_tier' : null,
		hasWholesaleClassification ? 'wholesale_classification' : null
	].filter((signal): signal is string => Boolean(signal));

	if (signals.length === 0) {
		return {
			label: 'not_available',
			confidence: null,
			signals: [],
			message: 'No pricing signals are available.'
		};
	}

	return {
		label: hasTiers ? 'tiered' : 'listed',
		confidence: hasPrice && (hasTiers || hasSingleTier) ? 0.9 : 0.7,
		signals,
		message: hasTiers
			? 'Tiered pricing signals are present.'
			: 'A listed per-pound price signal is present.'
	};
}

function getOverallLabel(familiesWithSignals: number): CatalogProofOverallLabel {
	if (familiesWithSignals >= 4) return 'strong';
	if (familiesWithSignals >= 2) return 'partial';
	if (familiesWithSignals === 1) return 'limited';
	return 'not_available';
}

export function createCatalogProofSummary(item: CatalogProofInput): CatalogProofSummary {
	const families = {
		process: buildProcessFamily(item),
		provenance: buildProvenanceFamily(item),
		freshness: buildFreshnessFamily(item),
		pricing: buildPricingFamily(item)
	} satisfies Record<CatalogProofFamilyKey, CatalogProofFamily>;
	const familiesWithSignals = Object.values(families).filter(
		(family) => family.signals.length > 0
	).length;

	return {
		version: 'proof-summary-v1',
		overall: {
			label: getOverallLabel(familiesWithSignals),
			families_with_signals: familiesWithSignals
		},
		families,
		limitations: [
			'not_certification',
			'raw_evidence_not_included',
			'supplier_verification_not_performed'
		]
	};
}

export function getCatalogProofBadges(summary: CatalogProofSummary): CatalogProofBadge[] {
	const badges: CatalogProofBadge[] = [];

	if (summary.families.process.label === 'disclosed') {
		badges.push({
			key: 'process-disclosed',
			family: 'process',
			label: 'Process disclosed',
			title: 'Structured process signals are present. This is not certification.'
		});
	}

	if (summary.families.provenance.label === 'identified') {
		badges.push({
			key: 'provenance-identified',
			family: 'provenance',
			label: 'Provenance identified',
			title: 'Origin and supplier-level provenance signals are present.'
		});
	} else if (summary.families.provenance.label === 'partial') {
		badges.push({
			key: 'provenance-partial',
			family: 'provenance',
			label: 'Provenance partial',
			title: 'Some origin signals are present, but the summary is incomplete.'
		});
	}

	if (
		summary.families.freshness.label === 'recently_stocked' ||
		summary.families.freshness.label === 'dated'
	) {
		badges.push({
			key: 'freshness-dated',
			family: 'freshness',
			label: 'Freshness dated',
			title: 'Freshness and availability signals are date-based, not quality claims.'
		});
	}

	if (summary.families.pricing.label === 'tiered') {
		badges.push({
			key: 'pricing-tiered',
			family: 'pricing',
			label: 'Tiered pricing',
			title: 'Multiple public price tiers are present.'
		});
	} else if (summary.families.pricing.label === 'listed') {
		badges.push({
			key: 'pricing-listed',
			family: 'pricing',
			label: 'Price listed',
			title: 'A listed per-pound price signal is present.'
		});
	}

	return badges;
}

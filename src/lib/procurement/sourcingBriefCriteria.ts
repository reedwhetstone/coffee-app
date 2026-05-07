import type { CatalogSearchOptions } from '$lib/data/catalog';

export const SOURCING_BRIEF_CRITERIA_VERSION = 1;

export const SOURCING_BRIEF_ALLOWED_FIELDS = [
	'country',
	'region',
	'processing',
	'processing_base_method',
	'max_price_per_lb',
	'stocked_only',
	'wholesale_only',
	'stocked_days'
] as const;

export type SourcingBriefCriteriaField = (typeof SOURCING_BRIEF_ALLOWED_FIELDS)[number];

export interface SourcingBriefCriteria {
	version: typeof SOURCING_BRIEF_CRITERIA_VERSION;
	country?: string;
	region?: string;
	processing?: string;
	processing_base_method?: string;
	max_price_per_lb?: number;
	stocked_only?: boolean;
	wholesale_only?: boolean;
	stocked_days?: number;
}

export interface SourcingBriefValidationIssue {
	field: string;
	message: string;
	allowedValues?: readonly string[];
}

export class SourcingBriefCriteriaValidationError extends Error {
	constructor(public issues: SourcingBriefValidationIssue[]) {
		super('Sourcing brief criteria failed validation');
		this.name = 'SourcingBriefCriteriaValidationError';
	}
}

const FIELD_SET = new Set<string>(SOURCING_BRIEF_ALLOWED_FIELDS);
const MAX_TEXT_LENGTH = 120;
const MAX_STOCKED_DAYS = 365;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, field: string, issues: SourcingBriefValidationIssue[]) {
	if (value === undefined) return undefined;
	if (typeof value !== 'string') {
		issues.push({ field, message: `${field} must be a string` });
		return undefined;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		issues.push({ field, message: `${field} must not be empty` });
		return undefined;
	}
	if (trimmed.length > MAX_TEXT_LENGTH) {
		issues.push({ field, message: `${field} must be ${MAX_TEXT_LENGTH} characters or fewer` });
		return undefined;
	}

	return trimmed;
}

function normalizeBoolean(value: unknown, field: string, issues: SourcingBriefValidationIssue[]) {
	if (value === undefined) return undefined;
	if (typeof value !== 'boolean') {
		issues.push({ field, message: `${field} must be a boolean` });
		return undefined;
	}
	return value;
}

function normalizePositiveNumber(
	value: unknown,
	field: string,
	issues: SourcingBriefValidationIssue[]
) {
	if (value === undefined) return undefined;
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		issues.push({ field, message: `${field} must be a positive number` });
		return undefined;
	}
	return Number(value.toFixed(2));
}

function normalizePositiveInteger(
	value: unknown,
	field: string,
	issues: SourcingBriefValidationIssue[]
): number | undefined {
	if (value === undefined) return undefined;
	if (
		typeof value !== 'number' ||
		!Number.isInteger(value) ||
		value <= 0 ||
		value > MAX_STOCKED_DAYS
	) {
		issues.push({
			field,
			message: `${field} must be an integer between 1 and ${MAX_STOCKED_DAYS}`
		});
		return undefined;
	}
	return value;
}

export function validateSourcingBriefCriteria(input: unknown): SourcingBriefCriteria {
	const issues: SourcingBriefValidationIssue[] = [];

	if (!isRecord(input)) {
		throw new SourcingBriefCriteriaValidationError([
			{ field: 'criteria', message: 'criteria must be an object' }
		]);
	}

	for (const field of Object.keys(input)) {
		if (field === 'version') continue;
		if (!FIELD_SET.has(field)) {
			issues.push({
				field,
				message: `${field} is not supported by sourcing brief criteria`,
				allowedValues: SOURCING_BRIEF_ALLOWED_FIELDS
			});
		}
	}

	if (input.version !== undefined && input.version !== SOURCING_BRIEF_CRITERIA_VERSION) {
		issues.push({
			field: 'version',
			message: `version must be ${SOURCING_BRIEF_CRITERIA_VERSION}`
		});
	}

	const criteria: SourcingBriefCriteria = {
		version: SOURCING_BRIEF_CRITERIA_VERSION
	};
	const country = normalizeText(input.country, 'country', issues);
	const region = normalizeText(input.region, 'region', issues);
	const processing = normalizeText(input.processing, 'processing', issues);
	const processingBaseMethod = normalizeText(
		input.processing_base_method,
		'processing_base_method',
		issues
	);
	const maxPricePerLb = normalizePositiveNumber(input.max_price_per_lb, 'max_price_per_lb', issues);
	const stockedOnly = normalizeBoolean(input.stocked_only, 'stocked_only', issues);
	const wholesaleOnly = normalizeBoolean(input.wholesale_only, 'wholesale_only', issues);
	const stockedDays = normalizePositiveInteger(input.stocked_days, 'stocked_days', issues);

	if (country !== undefined) criteria.country = country;
	if (region !== undefined) criteria.region = region;
	if (processing !== undefined) criteria.processing = processing;
	if (processingBaseMethod !== undefined) criteria.processing_base_method = processingBaseMethod;
	if (maxPricePerLb !== undefined) criteria.max_price_per_lb = maxPricePerLb;
	if (stockedOnly !== undefined) criteria.stocked_only = stockedOnly;
	if (wholesaleOnly !== undefined) criteria.wholesale_only = wholesaleOnly;
	if (stockedDays !== undefined) criteria.stocked_days = stockedDays;

	const meaningfulFieldCount = Object.keys(criteria).filter((field) => field !== 'version').length;
	if (meaningfulFieldCount === 0) {
		issues.push({
			field: 'criteria',
			message: 'criteria must include at least one supported sourcing constraint',
			allowedValues: SOURCING_BRIEF_ALLOWED_FIELDS
		});
	}

	if (issues.length > 0) {
		throw new SourcingBriefCriteriaValidationError(issues);
	}

	return criteria;
}

export function sourcingBriefCriteriaToCatalogSearchOptions(
	criteria: SourcingBriefCriteria
): Pick<
	CatalogSearchOptions,
	| 'country'
	| 'region'
	| 'processing'
	| 'processingBaseMethod'
	| 'pricePerLbMax'
	| 'stockedFilter'
	| 'wholesaleOnly'
	| 'stockedDays'
> {
	return {
		country: criteria.country,
		region: criteria.region,
		processing: criteria.processing,
		processingBaseMethod: criteria.processing_base_method,
		pricePerLbMax: criteria.max_price_per_lb,
		stockedFilter: criteria.stocked_only === false ? null : true,
		wholesaleOnly: criteria.wholesale_only === true,
		stockedDays: criteria.stocked_days
	};
}

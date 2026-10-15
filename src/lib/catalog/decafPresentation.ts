import type { components } from '@purveyors/sdk';
import type { CatalogItem } from '$lib/data/catalog';

/**
 * Presentation facts are derived from Parchment's catalog schema. Partial fields
 * model older cached/BFF responses while the legacy processing label remains.
 */
export type DecafPresentationInput = Partial<Pick<CatalogItem, 'processing'>> & {
	decaffeinated?:
		| CatalogItem['decaffeinated']
		| components['schemas']['CatalogSimilarityMatch']['coffee']['decaffeinated'];
	decafMethod?: Pick<NonNullable<CatalogItem['decafMethod']>, 'label'> | null;
};

export interface DecafPresentation {
	isDecaffeinated: boolean;
	methodLabel: string | null;
}

function legacyMethodLabel(processing: string | null | undefined): string | null {
	if (!processing) return null;
	const label = processing.trim();
	if (!label) return null;
	if (/\bswiss\s+water\b/i.test(label)) return 'Swiss Water';
	if (/\bmountain\s+water\b/i.test(label)) return 'Mountain Water';
	if (/\b(?:ethyl\s+acetate|sugar\s*cane|\bea\b)\b/i.test(label)) return 'Ethyl acetate';
	if (/\b(?:methylene\s+chloride|\bmc\b|\bkvw\b|european\s+process)\b/i.test(label)) {
		return 'Methylene chloride';
	}
	if (/\b(?:co2|carbon\s+dioxide|supercritical\s+co2)\b/i.test(label)) {
		return 'Carbon dioxide';
	}
	if (/\bwater\s+process\b/i.test(label)) return 'Water process';
	return null;
}

function isLegacyDecafLabel(processing: string | null | undefined): boolean {
	if (!processing) return false;
	return /\bdecaf(?:feinated)?\b/i.test(processing) || legacyMethodLabel(processing) !== null;
}

/**
 * Show the structured decaffeination fact when Parchment provides it. Older
 * responses fall back only to their processing label; coffee/supplier names are
 * deliberately outside this input. A structured false is authoritative even
 * when a stale label still says decaf.
 */
export function getDecafPresentation(coffee: DecafPresentationInput): DecafPresentation {
	const structuredStatus = coffee.decaffeinated;
	const legacyLabel = coffee.processing;
	const isDecaffeinated =
		typeof structuredStatus === 'boolean'
			? structuredStatus
			: coffee.decafMethod != null || isLegacyDecafLabel(legacyLabel);

	if (!isDecaffeinated) {
		return { isDecaffeinated: false, methodLabel: null };
	}

	// `null` means the current contract has no disclosed method. Only an omitted
	// method field needs the label fallback used by older responses.
	const structuredMethodLabel = coffee.decafMethod?.label.trim() || null;
	const methodLabel =
		structuredMethodLabel ??
		(coffee.decafMethod === undefined ||
		(typeof structuredStatus !== 'boolean' && coffee.decafMethod === null)
			? legacyMethodLabel(legacyLabel)
			: null);

	return { isDecaffeinated: true, methodLabel };
}

import type { ProfileOptionKind } from './profile-picker-model';

/** One side of a comparison as it appears in a link: a roast or a saved reference. */
export type CompareSide = { type: 'roast'; id: number } | { type: 'ref'; id: string };

export interface CompareSides {
	a: CompareSide | null;
	b: CompareSide | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROAST_ID = /^[1-9]\d*$/;

/** Read `roast:<id>` or `ref:<uuid>`. Anything else is not a side. */
export function parseCompareSide(value: string | null | undefined): CompareSide | null {
	const text = value?.trim();
	if (!text) return null;
	const separator = text.indexOf(':');
	if (separator === -1) return null;
	const type = text.slice(0, separator);
	const id = text.slice(separator + 1);
	if (type === 'roast') {
		if (!ROAST_ID.test(id)) return null;
		const roastId = Number(id);
		return Number.isSafeInteger(roastId) ? { type: 'roast', id: roastId } : null;
	}
	if (type === 'ref') return UUID.test(id) ? { type: 'ref', id: id.toLowerCase() } : null;
	return null;
}

export function formatCompareSide(side: CompareSide): string {
	return `${side.type}:${side.id}`;
}

/** Read both sides from a comparison link. A side that cannot be read is left empty. */
export function readCompareSides(searchParams: URLSearchParams): CompareSides {
	return {
		a: parseCompareSide(searchParams.get('a')),
		b: parseCompareSide(searchParams.get('b'))
	};
}

/**
 * The link to a comparison. A side holds only digits, hex, hyphens, and one colon, so it is
 * written as it reads: `/roast/compare?a=roast:4531&b=roast:4507`.
 */
export function compareHref(sides: Partial<CompareSides> = {}): string {
	const query = (['a', 'b'] as const)
		.flatMap((key) => {
			const side = sides[key];
			return side ? [`${key}=${formatCompareSide(side)}`] : [];
		})
		.join('&');
	return query ? `/roast/compare?${query}` : '/roast/compare';
}

/** The picker's value for a side: `executed_roast:<id>` or `reference_profile:<uuid>`. */
export function compareSideToOptionValue(side: CompareSide | null): string {
	if (!side) return '';
	return side.type === 'roast' ? `executed_roast:${side.id}` : `reference_profile:${side.id}`;
}

export function optionValueToCompareSide(value: string): CompareSide | null {
	const separator = value.indexOf(':');
	if (separator === -1) return null;
	const kind = value.slice(0, separator) as ProfileOptionKind;
	const id = value.slice(separator + 1);
	if (kind === 'executed_roast') return parseCompareSide(`roast:${id}`);
	if (kind === 'reference_profile') return parseCompareSide(`ref:${id}`);
	return null;
}

/** The link that opens one roast. */
export function roastHref(roastId: number | string): string {
	return `/roast?roast=${roastId}`;
}

/** The roast a `/roast` link asks for. `?profileId=` is the earlier name and is still read. */
export function readOpenRoastId(searchParams: URLSearchParams): number | null {
	for (const name of ['roast', 'profileId']) {
		const value = searchParams.get(name)?.trim();
		if (value && ROAST_ID.test(value)) {
			const roastId = Number(value);
			if (Number.isSafeInteger(roastId)) return roastId;
		}
	}
	return null;
}

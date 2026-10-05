import { describe, expect, it } from 'vitest';
import {
	compareHref,
	compareSideToOptionValue,
	formatCompareSide,
	optionValueToCompareSide,
	parseCompareSide,
	readCompareSides,
	readOpenRoastId,
	roastHref,
	type CompareSide
} from './compare-sides';

const REFERENCE = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER_REFERENCE = 'aaaaaaaa-0000-4000-8000-000000000002';

const sidesOf = (href: string) => readCompareSides(new URL(href, 'http://localhost').searchParams);

describe('comparison link sides', () => {
	it('reads a roast side and a saved reference side', () => {
		expect(parseCompareSide('roast:4531')).toEqual({ type: 'roast', id: 4531 });
		expect(parseCompareSide(`ref:${REFERENCE}`)).toEqual({ type: 'ref', id: REFERENCE });
		expect(parseCompareSide(`  ref:${REFERENCE.toUpperCase()} `)).toEqual({
			type: 'ref',
			id: REFERENCE
		});
	});

	it.each([
		null,
		undefined,
		'',
		'4531',
		'roast:',
		'roast:0',
		'roast:-4',
		'roast:4.5',
		'roast:abc',
		'roast:4531x',
		'roast:99999999999999999999',
		'ref:',
		'ref:4531',
		'ref:not-a-uuid',
		`plan:${REFERENCE}`,
		`executed_roast:4531`
	])('does not read %j as a side', (value) => {
		expect(parseCompareSide(value)).toBeNull();
	});

	it('writes a side the way it reads', () => {
		const sides: CompareSide[] = [
			{ type: 'roast', id: 4531 },
			{ type: 'ref', id: REFERENCE }
		];
		for (const side of sides) expect(parseCompareSide(formatCompareSide(side))).toEqual(side);
	});
});

describe('comparison links', () => {
	it('writes two roasts as the plan shows them, colons and all', () => {
		expect(compareHref({ a: { type: 'roast', id: 4531 }, b: { type: 'roast', id: 4507 } })).toBe(
			'/roast/compare?a=roast:4531&b=roast:4507'
		);
	});

	it('writes one side, either side, or neither', () => {
		expect(compareHref({ a: { type: 'roast', id: 4531 } })).toBe('/roast/compare?a=roast:4531');
		expect(compareHref({ a: null, b: { type: 'ref', id: REFERENCE } })).toBe(
			`/roast/compare?b=ref:${REFERENCE}`
		);
		expect(compareHref()).toBe('/roast/compare');
		expect(compareHref({ a: null, b: null })).toBe('/roast/compare');
	});

	it.each<[string, { a: CompareSide | null; b: CompareSide | null }]>([
		['two roasts', { a: { type: 'roast', id: 4531 }, b: { type: 'roast', id: 4507 } }],
		[
			'a roast and a saved reference',
			{ a: { type: 'roast', id: 4531 }, b: { type: 'ref', id: REFERENCE } }
		],
		[
			'two saved references, no roast',
			{ a: { type: 'ref', id: REFERENCE }, b: { type: 'ref', id: OTHER_REFERENCE } }
		],
		['only the first side', { a: { type: 'roast', id: 4531 }, b: null }],
		['only the second side', { a: null, b: { type: 'ref', id: REFERENCE } }],
		['neither side', { a: null, b: null }]
	])('round-trips %s through the link', (_name, sides) => {
		expect(sidesOf(compareHref(sides))).toEqual(sides);
	});

	it('reads a link whose colons were percent-encoded on the way', () => {
		expect(sidesOf(`/roast/compare?a=roast%3A4531&b=ref%3A${REFERENCE}`)).toEqual({
			a: { type: 'roast', id: 4531 },
			b: { type: 'ref', id: REFERENCE }
		});
	});

	it('leaves a side empty when it cannot be read, and keeps the other', () => {
		expect(sidesOf('/roast/compare?a=roast:4531&b=nonsense')).toEqual({
			a: { type: 'roast', id: 4531 },
			b: null
		});
		expect(sidesOf('/roast/compare?b=roast:4507')).toEqual({
			a: null,
			b: { type: 'roast', id: 4507 }
		});
	});

	it('converts between a side and the value the picker holds', () => {
		expect(compareSideToOptionValue({ type: 'roast', id: 4531 })).toBe('executed_roast:4531');
		expect(compareSideToOptionValue({ type: 'ref', id: REFERENCE })).toBe(
			`reference_profile:${REFERENCE}`
		);
		expect(compareSideToOptionValue(null)).toBe('');

		expect(optionValueToCompareSide('executed_roast:4531')).toEqual({ type: 'roast', id: 4531 });
		expect(optionValueToCompareSide(`reference_profile:${REFERENCE}`)).toEqual({
			type: 'ref',
			id: REFERENCE
		});
		expect(optionValueToCompareSide('')).toBeNull();
		expect(optionValueToCompareSide('something_else:1')).toBeNull();
	});
});

describe('the link to one roast', () => {
	const open = (search: string) => readOpenRoastId(new URLSearchParams(search));

	it('is written as ?roast=<id>', () => {
		expect(roastHref(4531)).toBe('/roast?roast=4531');
		expect(open(new URL(roastHref(4531), 'http://localhost').search)).toBe(4531);
	});

	it('still reads the earlier ?profileId=<id> name', () => {
		expect(open('?profileId=4531')).toBe(4531);
	});

	it('prefers ?roast= when a link carries both names', () => {
		expect(open('?profileId=4507&roast=4531')).toBe(4531);
	});

	it('falls back to ?profileId= when ?roast= cannot be read', () => {
		expect(open('?roast=abc&profileId=4507')).toBe(4507);
	});

	it.each(['', '?modal=new', '?roast=', '?roast=0', '?roast=4.5', '?profileId=x'])(
		'opens no roast for %j',
		(search) => {
			expect(open(search)).toBeNull();
		}
	);
});

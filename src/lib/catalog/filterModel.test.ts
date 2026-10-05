import { describe, expect, it } from 'vitest';
import {
	activePricePresetId,
	catalogFilterLock,
	catalogSortOptions,
	describeActiveCatalogFilters,
	type CatalogFilterAccess
} from './filterModel';

const anonymous: CatalogFilterAccess = {
	canUseProcessFacets: false,
	canUseAdvancedFilters: false,
	canUsePriceRanges: false,
	canUsePriceScoreRanges: false,
	canUseAdvancedSorts: false,
	canUseWholesaleOnly: false
};
const freeAccount: CatalogFilterAccess = { ...anonymous, canUsePriceRanges: true };
const member: CatalogFilterAccess = {
	canUseProcessFacets: true,
	canUseAdvancedFilters: true,
	canUsePriceRanges: true,
	canUsePriceScoreRanges: true,
	canUseAdvancedSorts: true,
	canUseWholesaleOnly: true
};

const CONTROLS = [
	'price',
	'process',
	'variety',
	'freshness',
	'elevation',
	'score',
	'wholesaleOnly',
	'advancedSort'
] as const;

function lockedControls(access: CatalogFilterAccess): string[] {
	return CONTROLS.filter((control) => catalogFilterLock(access, control) !== null);
}

describe('catalogFilterLock', () => {
	it('locks every gated control for anonymous visitors, with price asking for a free sign-in', () => {
		expect(lockedControls(anonymous)).toEqual([...CONTROLS]);
		expect(catalogFilterLock(anonymous, 'price')).toEqual({
			reason: 'Sign in with a free account to filter by price.',
			href: '/auth',
			action: 'Sign in free'
		});
		expect(catalogFilterLock(anonymous, 'process')).toMatchObject({ href: '/subscription' });
	});

	it('opens only the price range for a signed-in free account', () => {
		expect(lockedControls(freeAccount)).toEqual(CONTROLS.filter((control) => control !== 'price'));
	});

	it('locks nothing for members', () => {
		expect(lockedControls(member)).toEqual([]);
	});
});

describe('catalogSortOptions', () => {
	it('offers the curated list, with Purveyor Score locked below member level', () => {
		const { options, activeId } = catalogSortOptions(freeAccount, { field: null, direction: null });

		expect(activeId).toBe('recent');
		expect(options.map((option) => [option.label, option.locked === true])).toEqual([
			['Recently stocked', false],
			['Price, low to high', false],
			['Price, high to low', false],
			['Purveyor Score (listing completeness)', true],
			['Name, A to Z', false]
		]);
		expect(catalogSortOptions(member, { field: null, direction: null }).options[3].locked).toBe(
			undefined
		);
	});

	it('recognizes the curated sorts in a link, including the older price field name', () => {
		const active = (field: string | null, direction: 'asc' | 'desc' | null) =>
			catalogSortOptions(member, { field, direction }).activeId;

		expect(active('stocked_date', 'desc')).toBe('recent');
		expect(active('price_per_lb', 'asc')).toBe('price_asc');
		expect(active('cost_lb', 'desc')).toBe('price_desc');
		expect(active('purveyor_score', 'desc')).toBe('purveyor_score');
		expect(active('name', 'asc')).toBe('name');
	});

	it('keeps a retired sort from an older link selectable instead of changing the order', () => {
		const { options, activeId } = catalogSortOptions(member, {
			field: 'region',
			direction: 'asc'
		});

		expect(activeId).toBe('custom:region:asc');
		expect(options).toHaveLength(6);
		expect(options[5]).toEqual({
			id: 'custom:region:asc',
			label: 'Region, ascending',
			field: 'region',
			direction: 'asc'
		});
	});
});

describe('activePricePresetId', () => {
	it('names the preset a range matches, and nothing for a custom range', () => {
		expect(activePricePresetId({ min: '', max: '8' })).toBe('under_8');
		expect(activePricePresetId({ min: 8, max: 12 })).toBe('8_to_12');
		expect(activePricePresetId({ min: '12', max: '' })).toBe('over_12');
		expect(activePricePresetId({ min: '9', max: '11' })).toBeNull();
		expect(activePricePresetId(undefined)).toBeNull();
	});
});

describe('describeActiveCatalogFilters', () => {
	const none = { filters: {}, showWholesale: true, wholesaleOnly: false, includeUnstocked: false };

	it('lists nothing for the default view', () => {
		expect(describeActiveCatalogFilters(none)).toEqual([]);
	});

	it('labels each filter for a shopper, using the vocabulary for standardized codes', () => {
		const chips = describeActiveCatalogFilters(
			{
				...none,
				filters: {
					name: 'guji',
					country: ['Kenya', 'Ethiopia'],
					source: ['sweet_marias'],
					processing_base_method: 'wet_hulled',
					variety_code: ['pink_bourbon'],
					species_code: ['arabica'],
					drying_method_code: ['raised_bed'],
					has_additives: false,
					cost_lb: { min: '8', max: '' },
					elevation_masl: { min: '1500', max: '2000', includeUnknown: true },
					score_value: { min: '', max: '88' },
					stocked_days: '30'
				}
			},
			{
				varieties: [{ code: 'pink_bourbon', label: 'Pink Bourbon', parent_code: 'bourbon' }],
				species: [{ code: 'arabica', label: 'Arabica (C. arabica)', parent_code: null }],
				drying_methods: []
			}
		);

		expect(chips.map((chip) => chip.label)).toEqual([
			'Name: guji',
			'Process: Wet Hulled',
			'Origin: Kenya',
			'Origin: Ethiopia',
			"Supplier: Sweet Maria's",
			'Drying: Raised Bed',
			'Variety: Pink Bourbon',
			'Species: Arabica (C. arabica)',
			'No additives',
			'Price: $8 and up per lb',
			'Elevation: 1,500 m to 2,000 m, or not stated',
			'Cup score: up to 88',
			'Stocked in the last 30 days'
		]);
	});

	it('removes one value of a multi-value filter and clears a single-value one', () => {
		const chips = describeActiveCatalogFilters({
			...none,
			filters: { country: ['Kenya', 'Ethiopia'], region: 'Huila' }
		});

		expect(chips.find((chip) => chip.id === 'country:Kenya')?.remove).toEqual({
			kind: 'filter',
			key: 'country',
			value: ['Ethiopia']
		});
		expect(chips.find((chip) => chip.id === 'region')?.remove).toEqual({
			kind: 'filter',
			key: 'region',
			value: ''
		});
	});

	it('still lists filters from an older link whose controls are retired', () => {
		const chips = describeActiveCatalogFilters({
			...none,
			filters: {
				grade: 'SHB',
				appearance: 'EP',
				type: 'Importer',
				processing: 'Natural',
				processing_confidence_min: 0.8,
				cultivar_detail: 'Caturra'
			}
		});

		expect(chips.map((chip) => chip.label)).toEqual([
			'Process: Natural',
			'Variety name: Caturra',
			'Importer type: Importer',
			'Grade text: SHB',
			'Appearance: EP',
			'Process confidence: at least high'
		]);
	});

	it('lists the supplier scope and out-of-stock listing, and separates row filters from panel ones', () => {
		const hobbyist = describeActiveCatalogFilters({
			filters: { name: 'guji', region: 'Huila' },
			showWholesale: false,
			wholesaleOnly: false,
			includeUnstocked: true
		});

		expect(hobbyist.map((chip) => [chip.label, chip.inPanel])).toEqual([
			['Name: guji', false],
			['Region: Huila', true],
			['Hobbyist suppliers only', true],
			['Including out of stock', false]
		]);
		expect(
			describeActiveCatalogFilters({ ...none, wholesaleOnly: true }).map((chip) => chip.label)
		).toEqual(['Wholesale suppliers only']);
	});
});

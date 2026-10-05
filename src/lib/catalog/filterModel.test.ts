import { describe, expect, it } from 'vitest';
import {
	activePricePresetId,
	catalogFilterLock,
	catalogSortOptions,
	describeActiveCatalogFilters,
	isStatedScoreProtocol,
	scoreProtocolLabel,
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
	'grading',
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

	it('lists a repeated value once, so every chip has its own id', () => {
		const chips = describeActiveCatalogFilters({
			...none,
			filters: { country: ['Kenya', 'Kenya', 'Ethiopia'] }
		});

		expect(chips.map((chip) => chip.id)).toEqual(['country:Kenya', 'country:Ethiopia']);
		expect(chips[0].remove).toEqual({ kind: 'filter', key: 'country', value: ['Ethiopia'] });
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

describe('cup score sorting', () => {
	const labels = (protocol: string | null, current = { field: null, direction: null } as const) =>
		catalogSortOptions(member, current, protocol).options.map((option) => option.label);

	it('is offered only while one stated protocol is selected', () => {
		expect(labels(null)).not.toContain('Cup score, high to low');
		expect(labels('supplier_unspecified')).not.toContain('Cup score, high to low');
		expect(labels('made_up')).not.toContain('Cup score, high to low');
		expect(labels('sca_2004')).toEqual([
			'Recently stocked',
			'Price, low to high',
			'Price, high to low',
			'Purveyor Score (listing completeness)',
			'Cup score, high to low',
			'Name, A to Z'
		]);
	});

	it('is the active entry for a score sort under a stated protocol, and locked below member level', () => {
		const sorted = { field: 'score_value', direction: 'desc' } as const;

		expect(catalogSortOptions(member, sorted, 'q_arabica').activeId).toBe('cup_score');
		expect(
			catalogSortOptions(freeAccount, sorted, 'q_arabica').options.find(
				(option) => option.id === 'cup_score'
			)?.locked
		).toBe(true);
	});

	it('keeps a score sort from an older link as its own entry when no stated protocol is selected', () => {
		const { options, activeId } = catalogSortOptions(
			member,
			{ field: 'score_value', direction: 'desc' },
			null
		);

		expect(activeId).toBe('custom:score_value:desc');
		expect(options.at(-1)?.label).toBe('Cup score, descending');
	});

	it('names the protocols and tells stated ones apart', () => {
		expect(scoreProtocolLabel('supplier_unspecified')).toBe('Protocol not stated');
		expect(scoreProtocolLabel('coe')).toBe('Cup of Excellence');
		expect(['sca_2004', 'cva_affective', 'q_arabica', 'coe'].every(isStatedScoreProtocol)).toBe(
			true
		);
		expect([null, '', 'supplier_unspecified', 'made_up'].some(isStatedScoreProtocol)).toBe(false);
	});
});

describe('grade and quality chips', () => {
	const none = { filters: {}, showWholesale: true, wholesaleOnly: false, includeUnstocked: false };
	const grades = [
		{
			code: 'KE:AA',
			label: 'Kenya AA',
			description: '',
			dimensions: ['size'],
			sort_order: 100
		}
	];

	it('labels each filter, using the grade vocabulary where it has the code', () => {
		const chips = describeActiveCatalogFilters(
			{
				...none,
				filters: {
					grade_code: ['KE:AA', 'XX:NEW'],
					peaberry: true,
					lab_analyzed: true,
					screen_size: { min: '15', max: '', includeUnknown: true },
					moisture_max: 11.5,
					score_protocol: 'supplier_unspecified'
				}
			},
			null,
			grades
		);

		expect(chips.map((chip) => chip.label)).toEqual([
			'Grade: Kenya AA',
			'Grade: XX:NEW',
			'Peaberry',
			'Lab analyzed',
			'Screen size: 15 and up, or not stated',
			'Moisture: up to 11.5%',
			'Cup score protocol: Protocol not stated'
		]);
		expect(chips.every((chip) => chip.inPanel)).toBe(true);
	});

	it('removes one grade and keeps the others', () => {
		const chips = describeActiveCatalogFilters(
			{ ...none, filters: { grade_code: ['KE:AA', 'ET:G1'] } },
			null,
			grades
		);

		expect(chips[0].remove).toEqual({ kind: 'filter', key: 'grade_code', value: ['ET:G1'] });
	});

	it('names the lock for the whole section', () => {
		expect(catalogFilterLock(freeAccount, 'grading')).toMatchObject({
			reason: 'Members filter by grade, screen size, moisture, growing elevation and cup score.',
			href: '/subscription'
		});
		expect(catalogFilterLock(member, 'grading')).toBeNull();
	});
});

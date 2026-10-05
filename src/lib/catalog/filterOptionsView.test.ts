import { describe, expect, it } from 'vitest';
import {
	arrivalOptionOrder,
	countedOptions,
	familyNotes,
	vocabularyOptions
} from './filterOptionsView';

describe('countedOptions', () => {
	const counts = [
		{ value: 'Kenya', count: 85 },
		{ value: 'Brazil', count: 216 },
		{ value: 'Yemen', count: 0 }
	];

	it('leaves out options that match nothing while the control has no selection', () => {
		const options = countedOptions({ values: ['Brazil', 'Kenya', 'Yemen'], counts, selected: [] });

		expect(options).toEqual([
			{ value: 'Brazil', label: 'Brazil', count: 216 },
			{ value: 'Kenya', label: 'Kenya', count: 85 }
		]);
	});

	it('keeps every option listed once the control has a selection, zeros included', () => {
		const options = countedOptions({ values: [], counts, selected: ['Kenya'], sort: 'label' });

		expect(options.map((option) => [option.value, option.count])).toEqual([
			['Brazil', 216],
			['Kenya', 85],
			['Yemen', 0]
		]);
	});

	it('always lists a selected value, even one the counts no longer mention', () => {
		const options = countedOptions({ values: [], counts: [], selected: ['Rwanda'] });

		expect(options).toEqual([{ value: 'Rwanda', label: 'Rwanda', count: 0 }]);
	});

	it('lists plain values with no count when counts are unknown', () => {
		const options = countedOptions({
			values: ['washed', null, ''],
			counts: undefined,
			selected: [],
			label: (value) => value.toUpperCase()
		});

		expect(options).toEqual([{ value: 'washed', label: 'WASHED', count: null }]);
	});

	it('drops values the caller filters out unless they are selected', () => {
		const options = countedOptions({
			values: [],
			counts: [
				{ value: 'washed', count: 4 },
				{ value: 'unknown', count: 9 }
			],
			selected: [],
			keep: (value) => value !== 'unknown'
		});

		expect(options.map((option) => option.value)).toEqual(['washed']);
	});
});

describe('vocabularyOptions', () => {
	const entries = [
		{ code: 'typica', label: 'Typica', parent_code: null },
		{ code: 'bourbon', label: 'Bourbon', parent_code: null },
		{ code: 'pink_bourbon', label: 'Pink Bourbon', parent_code: 'bourbon' },
		{ code: 'yellow_bourbon', label: 'Yellow Bourbon', parent_code: 'bourbon' },
		{ code: 'sl28', label: 'SL28', parent_code: null }
	];

	it('lists each family, then the values under it, with counts', () => {
		const options = vocabularyOptions({
			entries,
			counts: [
				{ value: 'bourbon', count: 40 },
				{ value: 'pink_bourbon', count: 6 },
				{ value: 'typica', count: 12 }
			],
			selected: []
		});

		expect(options).toEqual([
			{ value: 'bourbon', label: 'Bourbon', count: 40 },
			{ value: 'pink_bourbon', label: 'Pink Bourbon', count: 6, indent: true },
			{ value: 'typica', label: 'Typica', count: 12 }
		]);
	});

	it('lists the whole vocabulary, zeros included, once a value is selected', () => {
		const options = vocabularyOptions({
			entries,
			counts: [{ value: 'bourbon', count: 40 }],
			selected: ['sl28']
		});

		expect(options.map((option) => [option.value, option.count])).toEqual([
			['bourbon', 40],
			['pink_bourbon', 0],
			['yellow_bourbon', 0],
			['sl28', 0],
			['typica', 0]
		]);
	});

	it('lists nothing when no coffee carries a code', () => {
		expect(vocabularyOptions({ entries, counts: [], selected: [] })).toEqual([]);
	});
});

describe('familyNotes', () => {
	it('says which values a family includes', () => {
		expect(
			familyNotes([
				{ code: 'raised_bed', label: 'Raised beds', parent_code: null },
				{ code: 'african_bed', label: 'African beds', parent_code: 'raised_bed' },
				{ code: 'patio', label: 'Patio', parent_code: null }
			])
		).toEqual(['Raised beds includes African beds.']);
	});
});

describe('arrivalOptionOrder', () => {
	it('lists availability words first, then months from latest to earliest', () => {
		const options = ['April 2026', 'Spot', 'October 2026', 'December 2025', 'Afloat'].map(
			(value) => ({ value, label: value })
		);

		expect(arrivalOptionOrder(options).map((option) => option.value)).toEqual([
			'Afloat',
			'Spot',
			'October 2026',
			'April 2026',
			'December 2025'
		]);
	});
});

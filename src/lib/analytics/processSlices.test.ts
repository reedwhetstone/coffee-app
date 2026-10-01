import { describe, expect, it } from 'vitest';
import { foldSmallProcessSlices } from './processSlices';

describe('foldSmallProcessSlices', () => {
	it('folds small slices into an existing Other bucket without mutating input', () => {
		// 2026-10-01 retail mix: Anaerobic (2.9%) folds into the existing Other bucket.
		const input = Object.freeze(
			[
				{ name: 'Washed', count: 518 },
				{ name: 'Natural', count: 211 },
				{ name: 'Other', count: 80 },
				{ name: 'Honey', count: 41 },
				{ name: 'Anaerobic', count: 25 }
			].map((bucket) => Object.freeze(bucket))
		);
		expect(foldSmallProcessSlices(input)).toEqual([
			{ name: 'Washed', count: 518 },
			{ name: 'Natural', count: 211 },
			{ name: 'Other', count: 105 },
			{ name: 'Honey', count: 41 }
		]);
		expect(input[2].count).toBe(80);
	});

	it('creates Other when none exists and keeps large Unknown slices', () => {
		expect(
			foldSmallProcessSlices([
				{ name: 'Washed', count: 90 },
				{ name: 'Unknown', count: 8 },
				{ name: 'Anaerobic', count: 2 }
			])
		).toEqual([
			{ name: 'Washed', count: 90 },
			{ name: 'Unknown', count: 8 },
			{ name: 'Other', count: 2 }
		]);
	});
});

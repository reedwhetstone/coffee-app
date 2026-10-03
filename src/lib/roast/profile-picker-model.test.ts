import { describe, expect, it } from 'vitest';
import type { components } from '@purveyors/sdk';
import {
	buildProfileOptionGroups,
	filterProfileOptionGroups,
	findProfileOption,
	hasRecordedRoast,
	recordedRoasts,
	referenceOption,
	roastOption,
	type PickerRoast
} from './profile-picker-model';

type Summary = components['schemas']['ReferenceProfileSummary'];

const reference = (
	id: string,
	title: string,
	createdAt: string,
	sourceClass: Summary['sourceClass'] = 'artisan_upload'
): Summary => ({
	id,
	title,
	notes: null,
	sourceClass,
	status: 'active',
	currentRevisionId: `${id}-revision`,
	createdAt,
	updatedAt: createdAt
});

const roast = (roast_id: number, overrides: Partial<PickerRoast> = {}): PickerRoast => ({
	roast_id,
	coffee_name: 'Ethiopia Guji Gogogu Natural',
	batch_name: 'Ethiopia Guji Gogogu Natural - Green Batch - 8/4/2025',
	roast_date: '2026-09-30',
	charge_time: 12,
	...overrides
});

describe('profile picker options', () => {
	it('lists a recent Artisan roast that has no output weight recorded yet', () => {
		const imported = roast(4529, {
			charge_time: null,
			oz_out: null,
			weight_loss_percent: null,
			data_source: 'artisan_import'
		});

		expect(hasRecordedRoast(imported)).toBe(true);
		expect(recordedRoasts([imported])).toEqual([imported]);
	});

	it('leaves out only a roast with nothing recorded', () => {
		const planned = roast(7, { charge_time: null, data_source: 'manual' });
		const weighed = roast(8, { charge_time: null, oz_out: 12.5 });

		expect(hasRecordedRoast(planned)).toBe(false);
		expect(recordedRoasts([planned, weighed]).map((entry) => entry.roast_id)).toEqual([8]);
	});

	it('orders roasts most recent first, then by roast number within a day', () => {
		const ordered = recordedRoasts([
			roast(10, { roast_date: '2026-08-04' }),
			roast(4527, { roast_date: '2026-09-30T00:00:00+00:00' }),
			roast(4529, { roast_date: '2026-09-30' }),
			roast(11, { roast_date: null }),
			roast(4528, { roast_date: '2026-09-30' })
		]);

		expect(ordered.map((entry) => entry.roast_id)).toEqual([4529, 4528, 4527, 10, 11]);
	});

	it('labels a roast with its coffee, roast date, batch, and roast number', () => {
		expect(roastOption(roast(4529))).toEqual({
			value: 'executed_roast:4529',
			kind: 'executed_roast',
			id: '4529',
			title: 'Ethiopia Guji Gogogu Natural',
			detail: 'Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4529',
			label:
				'Ethiopia Guji Gogogu Natural · Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4529',
			spoken: 'Ethiopia Guji Gogogu Natural, roasted Sep 30, 2026'
		});
	});

	it('gives two roasts of the same batch on the same day different labels', () => {
		expect(roastOption(roast(4528)).label).not.toBe(roastOption(roast(4529)).label);
	});

	it('keeps a batch name that does not repeat the coffee name, and copes with missing fields', () => {
		expect(roastOption(roast(3, { batch_name: 'Sunday test batch' })).detail).toBe(
			'Roasted Sep 30, 2026 · Sunday test batch · Roast #3'
		);
		expect(roastOption(roast(4, { coffee_name: null, batch_name: 'newnewtest' }))).toMatchObject({
			title: 'newnewtest',
			detail: 'Roasted Sep 30, 2026 · Roast #4'
		});
		expect(
			roastOption(roast(5, { coffee_name: null, batch_name: null, roast_date: null }))
		).toMatchObject({ title: 'Roast #5', detail: 'No roast date · Roast #5' });
	});

	it('does not shift a roast date across time zones', () => {
		expect(roastOption(roast(6, { roast_date: '2026-09-30T23:30:00-07:00' })).detail).toContain(
			'Roasted Sep 30, 2026'
		);
	});

	it('labels a saved reference with how it was made and when it was saved', () => {
		expect(referenceOption(reference('a', 'Artisan reference', '2026-09-28T15:00:00Z'))).toEqual({
			value: 'reference_profile:a',
			kind: 'reference_profile',
			id: 'a',
			title: 'Artisan reference',
			detail: 'Artisan file · Saved Sep 28, 2026',
			label: 'Artisan reference · Artisan file · Saved Sep 28, 2026',
			spoken: 'Artisan reference, a saved reference'
		});
		expect(
			referenceOption(
				reference('b', 'Next-batch plan', '2026-10-01T09:00:00Z', 'generated_revision')
			).detail
		).toBe('Plan · Saved Oct 1, 2026');
		expect(
			referenceOption(reference('c', 'Guji reference', '2026-10-02T09:00:00Z', 'executed_roast'))
				.detail
		).toBe('Saved from a roast · Saved Oct 2, 2026');
	});

	it('groups saved references ahead of roasts, each most recent first, with nothing cut off', () => {
		const roasts = Array.from({ length: 260 }, (_, index) =>
			roast(index + 1, { roast_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}` })
		);
		const groups = buildProfileOptionGroups(roasts, [
			reference('old', 'Older reference', '2026-09-01T00:00:00Z'),
			reference('new', 'Newer reference', '2026-09-29T00:00:00Z')
		]);

		expect(groups.map((group) => [group.key, group.heading, group.total])).toEqual([
			['references', 'Saved references', 2],
			['roasts', 'Roasts', 260]
		]);
		expect(groups[0].options.map((option) => option.title)).toEqual([
			'Newer reference',
			'Older reference'
		]);
		expect(groups[1].options).toHaveLength(260);
		expect(groups[1].options[0].detail).toContain('Roasted Jan 28, 2026');
	});

	it('searches coffee, date, batch, and roast number, and reports the full group size', () => {
		const groups = buildProfileOptionGroups(
			[
				roast(4529),
				roast(4100, {
					coffee_name: 'Colombia Huila',
					batch_name: 'Colombia Huila',
					roast_date: '2026-08-12'
				})
			],
			[reference('a', 'Guji reference', '2026-09-28T00:00:00Z')]
		);

		const titles = (query: string) =>
			filterProfileOptionGroups(groups, query).map((group) =>
				group.options.map((option) => option.title)
			);

		expect(titles('guji')).toEqual([['Guji reference'], ['Ethiopia Guji Gogogu Natural']]);
		expect(titles('sep 30')).toEqual([[], ['Ethiopia Guji Gogogu Natural']]);
		expect(titles('#4100')).toEqual([[], ['Colombia Huila']]);
		expect(titles('green batch guji')).toEqual([[], ['Ethiopia Guji Gogogu Natural']]);
		expect(titles('  ')).toEqual([
			['Guji reference'],
			['Ethiopia Guji Gogogu Natural', 'Colombia Huila']
		]);
		expect(filterProfileOptionGroups(groups, 'huila')[1].total).toBe(2);
	});

	it('finds a chosen option in either group', () => {
		const groups = buildProfileOptionGroups(
			[roast(4529)],
			[reference('a', 'Guji reference', '2026-09-28T00:00:00Z')]
		);

		expect(findProfileOption(groups, 'reference_profile:a')?.title).toBe('Guji reference');
		expect(findProfileOption(groups, 'executed_roast:4529')?.id).toBe('4529');
		expect(findProfileOption(groups, 'executed_roast:1')).toBeNull();
	});
});

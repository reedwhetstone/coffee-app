import { describe, expect, it } from 'vitest';
import {
	hasRecordedCurve,
	roastCountLine,
	roastDetailLine,
	roastMilestones,
	type SummaryRoast
} from './roast-summary';

const recorded: SummaryRoast = {
	roast_id: 4531,
	batch_name: 'Wednesday roast',
	roast_date: '2026-10-01T00:00:00+00:00',
	oz_in: 16,
	oz_out: 13.7,
	weight_loss_percent: 14.4,
	temperature_unit: 'F',
	charge_time: 0,
	charge_temp: 392,
	tp_time: 78,
	dry_end_time: 266,
	fc_start_time: 498,
	drop_time: 618,
	drop_temp: 402,
	total_roast_time: 618,
	development_percent: 19.4,
	data_source: 'artisan_import'
};

const line = (roast: SummaryRoast) =>
	roastMilestones(roast)
		.map((milestone) => milestone.text)
		.join(' · ');

describe('roastMilestones', () => {
	it('reads a recorded roast in roast order', () => {
		expect(line(recorded)).toBe(
			'Charge 392°F · Turning point 1:18 · Dry end 4:26 · First crack 8:18 · Drop 10:18 at 402°F · Development 19.4%'
		);
	});

	it('names first crack when it was not marked, and leaves out the development it would give', () => {
		const milestones = roastMilestones({
			...recorded,
			fc_start_time: null,
			development_percent: null
		});

		expect(milestones.find((milestone) => milestone.key === 'first_crack')).toEqual({
			key: 'first_crack',
			label: 'First crack',
			value: null,
			text: 'First crack not marked'
		});
		expect(milestones.map((milestone) => milestone.key)).toEqual([
			'charge',
			'turning_point',
			'dry_end',
			'first_crack',
			'drop'
		]);
	});

	it('names every milestone a roaster marks when it is missing', () => {
		expect(
			line({
				roast_id: 9,
				data_source: 'artisan_import',
				charge_time: null,
				dry_end_time: null,
				fc_start_time: null,
				drop_time: null
			})
		).toBe('Charge not marked · Dry end not marked · First crack not marked · Drop not marked');
	});

	it('does not call a turning point unmarked: a roast logged live never has one', () => {
		const live = { ...recorded, tp_time: null, data_source: 'live' };

		expect(roastMilestones(live).some((milestone) => milestone.key === 'turning_point')).toBe(
			false
		);
		expect(line(live)).not.toContain('Turning point');
	});

	it('shows a marked charge only when its temperature is on record', () => {
		expect(line({ ...recorded, charge_temp: null })).toMatch(/^Turning point 1:18/);
	});

	it('gives the drop time alone when no drop temperature is on record', () => {
		expect(line({ ...recorded, drop_temp: null })).toContain('Drop 10:18 · Development');
	});

	it('uses the roast temperature unit', () => {
		expect(
			line({ ...recorded, temperature_unit: 'C', charge_temp: 200, drop_temp: 205 })
		).toContain('Drop 10:18 at 205°C');
	});
});

describe('hasRecordedCurve', () => {
	it('is false for a roast that was set up and never logged, even with a weight entered', () => {
		expect(hasRecordedCurve({ roast_id: 4540, oz_in: 8 })).toBe(false);
	});

	it('is true once a milestone, a roast time, or an Artisan import exists', () => {
		expect(hasRecordedCurve({ roast_id: 1, charge_time: 0 })).toBe(true);
		expect(hasRecordedCurve({ roast_id: 1, total_roast_time: 600 })).toBe(true);
		expect(hasRecordedCurve({ roast_id: 1, data_source: 'artisan_import' })).toBe(true);
	});
});

describe('roastDetailLine', () => {
	it('gives the number, the stored calendar day, the batch, and the weights with loss', () => {
		expect(roastDetailLine(recorded)).toBe(
			'Roast #4531 · Oct 1, 2026 · Wednesday roast · 16 → 13.7 oz (14.4% loss)'
		);
	});

	it('shows the weight in alone when no weight out was entered', () => {
		expect(
			roastDetailLine({
				roast_id: 4529,
				roast_date: '2026-09-27',
				batch_name: 'Guji drop test',
				oz_in: 12,
				oz_out: null
			})
		).toBe('Roast #4529 · Sep 27, 2026 · Guji drop test · 12 oz');
	});

	it('works out the loss when the roast carries none', () => {
		expect(roastDetailLine({ roast_id: 7, oz_in: 16, oz_out: 14 })).toBe(
			'Roast #7 · 16 → 14 oz (12.5% loss)'
		);
	});
});

describe('roastCountLine', () => {
	it('matches the roast list header', () => {
		expect(roastCountLine({ roasts: 14, batches: 10, averageLoss: 15 })).toBe(
			'14 roasts in 10 batches · 15.0% average loss'
		);
	});

	it('uses the singular and leaves the loss out when none is on record', () => {
		expect(roastCountLine({ roasts: 1, batches: 1, averageLoss: null })).toBe('1 roast in 1 batch');
	});
});

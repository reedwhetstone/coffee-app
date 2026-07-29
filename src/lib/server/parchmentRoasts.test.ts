import { describe, expect, it, vi } from 'vitest';
import { fetchParchmentRoasts } from './parchmentRoasts';

const roast = {
	roast_id: 9,
	batch_name: 'Guji test',
	coffee_id: 4,
	coffee_name: 'Ethiopia Guji',
	roast_date: '2026-07-29T20:00:00.000Z',
	oz_in: 16,
	oz_out: 13.5,
	weight_loss_percent: 15.63,
	roast_notes: null,
	roast_targets: null,
	roaster_type: null,
	roaster_size: null,
	temperature_unit: 'F',
	total_roast_time: 610,
	development_percent: 18,
	data_source: 'artisan',
	last_updated: '2026-07-29T20:15:00.000Z',
	roast_uuid: null,
	fc_start_time: 500,
	fc_start_temp: 395,
	fc_end_time: null,
	fc_end_temp: null,
	drop_time: 610,
	drop_temp: 420,
	charge_temp: 390,
	charge_time: 0,
	dry_end_time: 245,
	tp_time: 75,
	tp_temp: 180,
	total_ror: null,
	dry_percent: 40,
	maillard_percent: 42,
	auc: null,
	dry_phase_ror: null,
	mid_phase_ror: null,
	finish_phase_ror: null,
	dry_phase_delta_temp: null,
	is_wholesale: true
};

describe('fetchParchmentRoasts', () => {
	it('paginates every roast using stable roast ids', async () => {
		const secondRoast = { ...roast, roast_id: 8 };
		const list = vi
			.fn()
			.mockResolvedValueOnce({ data: { data: [roast] } })
			.mockResolvedValueOnce({ data: { data: [secondRoast] } })
			.mockResolvedValueOnce({ data: { data: [] } });

		await expect(fetchParchmentRoasts({ roasts: { list } } as never)).resolves.toEqual([
			roast,
			secondRoast
		]);
		expect(list).toHaveBeenNthCalledWith(1, { limit: 200, offset: 0 });
		expect(list).toHaveBeenNthCalledWith(2, { limit: 200, offset: 1 });
		expect(list).toHaveBeenNthCalledWith(3, { limit: 200, offset: 2 });
	});

	it('rejects a failed Parchment response', async () => {
		const list = vi.fn().mockResolvedValue({
			error: { message: 'roasts unavailable' },
			response: new Response(null, { status: 503 })
		});

		await expect(fetchParchmentRoasts({ roasts: { list } } as never)).rejects.toThrow(
			'roasts unavailable'
		);
	});
});

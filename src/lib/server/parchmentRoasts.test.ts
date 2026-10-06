import { describe, expect, it, vi } from 'vitest';
import {
	fetchParchmentRoastList,
	fetchParchmentRoastPage,
	fetchParchmentRoasts,
	ParchmentRoastListError,
	type ParchmentRoastTotals
} from './parchmentRoasts';

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

const totals = { roasts: 201, batches: 120, average_loss_percent: 15.63 };
const page = (data: unknown[], pageTotals: ParchmentRoastTotals = totals) => ({
	data: { data, meta: { totals: pageTotals } }
});
const failure = (status: number, code: string, message: string) => ({
	error: { error: { code, message } },
	response: new Response(null, { status })
});

describe('fetchParchmentRoastPage', () => {
	it('asks for one page and returns it with the totals for the whole filtered set', async () => {
		const list = vi.fn().mockResolvedValue(page([roast]));

		await expect(
			fetchParchmentRoastPage({ roasts: { list } } as never, {}, { limit: 50, offset: 100 })
		).resolves.toEqual({ data: [roast], totals });
		expect(list).toHaveBeenCalledOnce();
		expect(list).toHaveBeenCalledWith({ limit: 50, offset: 100 });
	});

	it('sends every filter under the name Parchment reads', async () => {
		const list = vi.fn().mockResolvedValue(page([]));
		const batchId = 'aaaaaaaa-0000-4000-8000-000000000001';

		await fetchParchmentRoastPage(
			{ roasts: { list } } as never,
			{
				coffeeId: 101,
				roastId: 4531,
				batchId,
				dateStart: '2026-09-01',
				dateEnd: '2026-09-30',
				q: 'guji',
				isWholesale: false
			},
			{ limit: 50, offset: 0 }
		);

		expect(list).toHaveBeenCalledWith({
			coffee_id: 101,
			roast_id: 4531,
			batch_id: batchId,
			date_start: '2026-09-01',
			date_end: '2026-09-30',
			q: 'guji',
			is_wholesale: false,
			limit: 50,
			offset: 0
		});
	});

	it('leaves a filter out of the request when it is not set', async () => {
		const list = vi.fn().mockResolvedValue(page([]));

		await fetchParchmentRoastPage(
			{ roasts: { list } } as never,
			{ isWholesale: true },
			{ limit: 50, offset: 0 }
		);

		expect(list).toHaveBeenCalledWith({ is_wholesale: true, limit: 50, offset: 0 });
	});

	it('reports the status and the code when Parchment turns a search down', async () => {
		const list = vi
			.fn()
			.mockResolvedValue(failure(400, 'invalid_query', 'q must be at most 100 characters'));

		const error = await fetchParchmentRoastPage(
			{ roasts: { list } } as never,
			{ q: 'x'.repeat(101) },
			{ limit: 50, offset: 0 }
		).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ParchmentRoastListError);
		expect(error).toMatchObject({
			status: 400,
			code: 'invalid_query',
			message: 'q must be at most 100 characters'
		});
	});
});

describe('fetchParchmentRoastList', () => {
	it('reads every page and keeps the totals', async () => {
		const firstPage = Array.from({ length: 200 }, (_, i) => ({ ...roast, roast_id: i + 10 }));
		const secondRoast = { ...roast, roast_id: 8 };
		const list = vi
			.fn()
			.mockResolvedValueOnce(page(firstPage))
			.mockResolvedValueOnce(page([secondRoast]));

		await expect(
			fetchParchmentRoastList({ roasts: { list } } as never, { batchId: 'b' })
		).resolves.toEqual({ data: [...firstPage, secondRoast], totals });
		expect(list).toHaveBeenNthCalledWith(1, { batch_id: 'b', limit: 200, offset: 0 });
		expect(list).toHaveBeenNthCalledWith(2, { batch_id: 'b', limit: 200, offset: 200 });
	});

	it('returns the totals when nothing matches', async () => {
		const none = { roasts: 0, batches: 0, average_loss_percent: null };
		const list = vi.fn().mockResolvedValue(page([], none));

		await expect(fetchParchmentRoastList({ roasts: { list } } as never)).resolves.toEqual({
			data: [],
			totals: none
		});
	});
});

describe('fetchParchmentRoasts', () => {
	it('paginates every roast using stable roast ids', async () => {
		const firstPage = Array.from({ length: 200 }, (_, i) => ({ ...roast, roast_id: i + 10 }));
		const secondRoast = { ...roast, roast_id: 8 };
		const list = vi
			.fn()
			.mockResolvedValueOnce(page(firstPage))
			.mockResolvedValueOnce(page([secondRoast]))
			.mockResolvedValueOnce(page([]));

		await expect(fetchParchmentRoasts({ roasts: { list } } as never)).resolves.toEqual([
			...firstPage,
			secondRoast
		]);
		expect(list).toHaveBeenNthCalledWith(1, { limit: 200, offset: 0 });
		expect(list).toHaveBeenNthCalledWith(2, { limit: 200, offset: 200 });
		expect(list).toHaveBeenCalledTimes(2);
	});

	it("asks Parchment for one coffee's roasts on every page when a coffee is given", async () => {
		const firstPage = Array.from({ length: 200 }, (_, i) => ({ ...roast, roast_id: i + 10 }));
		const list = vi.fn().mockResolvedValueOnce(page(firstPage)).mockResolvedValueOnce(page([]));

		await expect(
			fetchParchmentRoasts({ roasts: { list } } as never, { coffeeId: 101 })
		).resolves.toEqual(firstPage);
		expect(list).toHaveBeenNthCalledWith(1, { coffee_id: 101, limit: 200, offset: 0 });
		expect(list).toHaveBeenNthCalledWith(2, { coffee_id: 101, limit: 200, offset: 200 });
	});

	it('rejects a failed Parchment response', async () => {
		const list = vi.fn().mockResolvedValue(failure(503, 'unavailable', 'roasts unavailable'));

		await expect(fetchParchmentRoasts({ roasts: { list } } as never)).rejects.toThrow(
			'roasts unavailable'
		);
	});
});
